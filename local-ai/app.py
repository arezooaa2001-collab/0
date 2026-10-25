"""هوش مصنوعی محلی (Local AI Studio)

همه‌چیز روی کامپیوتر خودت اجرا می‌شود: بدون کلید API، بدون حساب کاربری، بدون اینترنت
(فقط بار اول برای دانلود مدل‌ها اینترنت لازم است).

  - چت:   Ollama  (پیش‌فرض: qwen2.5:7b)
  - عکس:  Stable Diffusion XL — مدل واقع‌گرای RealVisXL
  - ویدیو: Wan 2.1 (1.3B)
  - آهنگ: MusicGen از Meta

هر مدل را می‌توان با متغیرهای محیطی پایین عوض کرد.
"""

import gc
import json
import os
import re
import time
from pathlib import Path

# بدون ارسال آمار به اینترنت
os.environ.setdefault("GRADIO_ANALYTICS_ENABLED", "False")

import gradio as gr
import numpy as np
import requests

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
CHAT_MODEL = os.environ.get("CHAT_MODEL", "qwen2.5:7b")
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "SG161222/RealVisXL_V4.0")
VIDEO_MODEL = os.environ.get("VIDEO_MODEL", "Wan-AI/Wan2.1-T2V-1.3B-Diffusers")
MUSIC_MODEL = os.environ.get("MUSIC_MODEL", "facebook/musicgen-medium")

OUTPUT_DIR = Path(__file__).parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

SYSTEM_PROMPT = (
    "You are a warm, natural and helpful assistant. Talk like a real person, not a robot. "
    "Always answer in the same language the user writes in (if they write Persian, answer in fluent, "
    "natural Persian)."
)

IMAGE_NEGATIVE = (
    "cartoon, anime, 3d render, painting, illustration, plastic skin, deformed, extra fingers, "
    "bad hands, bad anatomy, blurry, low quality, watermark, text, oversaturated"
)
VIDEO_NEGATIVE = (
    "static, frozen, blurry, low quality, distorted, deformed, extra limbs, flickering, "
    "jpeg artifacts, watermark, text, cartoon, overexposed"
)


# ---------------------------------------------------------------- device helpers

def _torch():
    import torch

    return torch


def device():
    torch = _torch()
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def dtype():
    torch = _torch()
    return torch.float32 if device() == "cpu" else torch.float16


# Only one heavy model stays in memory at a time so it fits on an ordinary GPU.
_loaded = {"name": None, "obj": None}


def load(name, factory):
    if _loaded["name"] == name:
        return _loaded["obj"]
    _loaded["name"], _loaded["obj"] = None, None
    gc.collect()
    torch = _torch()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    _loaded["obj"] = factory()
    _loaded["name"] = name
    return _loaded["obj"]


def place(pipe):
    """GPU کم‌حافظه هم کار کند: لایه‌ها فقط موقع نیاز روی GPU می‌روند."""
    if device() == "cuda":
        pipe.enable_model_cpu_offload()
    else:
        pipe.to(device())
    return pipe


def output_path(ext):
    return str(OUTPUT_DIR / f"{time.strftime('%Y%m%d-%H%M%S')}.{ext}")


# ---------------------------------------------------------------- chat (Ollama)

def ollama_ok():
    try:
        requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        return True
    except requests.RequestException:
        return False


def chat(message, history):
    if not ollama_ok():
        yield "⚠️ Ollama روشن نیست. برنامه Ollama را باز کن (یا در ترمینال بنویس: ollama serve) و دوباره امتحان کن."
        return
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m["role"], "content": m["content"]} for m in history if isinstance(m.get("content"), str)]
    messages.append({"role": "user", "content": message})
    reply = ""
    with requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={"model": CHAT_MODEL, "messages": messages, "stream": True},
        stream=True,
        timeout=600,
    ) as r:
        if r.status_code == 404:
            yield f"⚠️ مدل {CHAT_MODEL} نصب نیست. در ترمینال بنویس: ollama pull {CHAT_MODEL}"
            return
        r.raise_for_status()
        for line in r.iter_lines():
            if not line:
                continue
            chunk = json.loads(line)
            reply += chunk.get("message", {}).get("content", "")
            yield reply
            if chunk.get("done"):
                break


def to_english(prompt, kind):
    """مدل‌های عکس/ویدیو/آهنگ انگلیسی را خیلی بهتر می‌فهمند؛ متن فارسی را با مدل چت ترجمه و غنی می‌کنیم."""
    if prompt.isascii() or not ollama_ok():
        return prompt
    instruction = (
        f"Rewrite the following request as one detailed English prompt for a {kind} generation model. "
        "Keep the meaning, add natural, realistic details. Output only the prompt, nothing else.\n\n"
        + prompt
    )
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": CHAT_MODEL, "prompt": instruction, "stream": False},
            timeout=300,
        )
        r.raise_for_status()
        text = r.json().get("response", "").strip().strip('"')
        return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip() or prompt
    except requests.RequestException:
        return prompt


# ---------------------------------------------------------------- image

def _image_pipe():
    from diffusers import DPMSolverMultistepScheduler, StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(IMAGE_MODEL, torch_dtype=dtype(), use_safetensors=True)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config, use_karras_sigmas=True, algorithm_type="dpmsolver++"
    )
    return place(pipe)


SIZES = {
    "مربع 1:1": (1024, 1024),
    "عمودی 3:4": (896, 1152),
    "افقی 4:3": (1152, 896),
    "استوری 9:16": (768, 1344),
    "عریض 16:9": (1344, 768),
}


def make_image(prompt, size, steps, seed, progress=gr.Progress()):
    if not prompt.strip():
        raise gr.Error("یک توضیح برای عکس بنویس.")
    progress(0, desc="آماده‌سازی متن...")
    en = to_english(prompt, "photorealistic image")
    progress(0.1, desc="بارگذاری مدل عکس (بار اول دانلود می‌شود)...")
    pipe = load("image", _image_pipe)
    w, h = SIZES[size]
    gen = _torch().Generator("cpu").manual_seed(int(seed)) if seed >= 0 else None
    progress(0.3, desc="در حال ساخت عکس...")
    image = pipe(
        prompt=en + ", natural lighting, photorealistic, highly detailed, 35mm photo",
        negative_prompt=IMAGE_NEGATIVE,
        width=w,
        height=h,
        num_inference_steps=int(steps),
        guidance_scale=5.0,
        generator=gen,
    ).images[0]
    path = output_path("png")
    image.save(path)
    return path, en


# ---------------------------------------------------------------- video

def _video_pipe():
    torch = _torch()
    from diffusers import AutoencoderKLWan, WanPipeline

    vae = AutoencoderKLWan.from_pretrained(VIDEO_MODEL, subfolder="vae", torch_dtype=torch.float32)
    pipe_dtype = torch.bfloat16 if device() == "cuda" else dtype()
    pipe = WanPipeline.from_pretrained(VIDEO_MODEL, vae=vae, torch_dtype=pipe_dtype)
    return place(pipe)


def make_video(prompt, seconds, steps, seed, progress=gr.Progress()):
    if not prompt.strip():
        raise gr.Error("یک توضیح برای ویدیو بنویس.")
    from diffusers.utils import export_to_video

    progress(0, desc="آماده‌سازی متن...")
    en = to_english(prompt, "realistic video")
    progress(0.1, desc="بارگذاری مدل ویدیو (بار اول دانلود می‌شود)...")
    pipe = load("video", _video_pipe)
    fps = 16
    # Wan needs 4k+1 frames.
    frames = int(seconds * fps) // 4 * 4 + 1
    gen = _torch().Generator("cpu").manual_seed(int(seed)) if seed >= 0 else None
    progress(0.3, desc="در حال ساخت ویدیو (چند دقیقه طول می‌کشد)...")
    video = pipe(
        prompt=en + ", realistic, natural motion, cinematic lighting",
        negative_prompt=VIDEO_NEGATIVE,
        height=480,
        width=832,
        num_frames=frames,
        num_inference_steps=int(steps),
        guidance_scale=5.0,
        generator=gen,
    ).frames[0]
    path = output_path("mp4")
    export_to_video(video, path, fps=fps)
    return path, en


# ---------------------------------------------------------------- music

def _music_model():
    from transformers import AutoProcessor, MusicgenForConditionalGeneration

    processor = AutoProcessor.from_pretrained(MUSIC_MODEL)
    model = MusicgenForConditionalGeneration.from_pretrained(MUSIC_MODEL).to(device())
    return processor, model


def make_music(prompt, seconds, progress=gr.Progress()):
    if not prompt.strip():
        raise gr.Error("یک توضیح برای آهنگ بنویس.")
    from scipy.io import wavfile

    progress(0, desc="آماده‌سازی متن...")
    en = to_english(prompt, "music")
    progress(0.1, desc="بارگذاری مدل آهنگ (بار اول دانلود می‌شود)...")
    processor, model = load("music", _music_model)
    inputs = processor(text=[en], padding=True, return_tensors="pt").to(device())
    rate = model.config.audio_encoder.sampling_rate
    progress(0.3, desc="در حال ساخت آهنگ...")
    # MusicGen produces about 50 tokens per second of audio.
    audio = model.generate(**inputs, do_sample=True, guidance_scale=3.0, max_new_tokens=int(seconds * 50))
    wave = audio[0, 0].float().cpu().numpy()
    wave = (wave / max(1e-6, np.abs(wave).max()) * 0.95 * 32767).astype(np.int16)
    path = output_path("wav")
    wavfile.write(path, rate, wave)
    return path, en


# ---------------------------------------------------------------- UI

CSS = """
.gradio-container { max-width: 1100px !important; margin: auto; }
#title { text-align: center; }
"""

with gr.Blocks(title="هوش مصنوعی من", css=CSS, theme=gr.themes.Soft(primary_hue="violet")) as demo:
    gr.Markdown(
        "# 🤖 هوش مصنوعی من\nچت، عکس، ویدیو و آهنگ — همه روی کامپیوتر خودت، بدون کلید API و بدون حساب کاربری.",
        elem_id="title",
        rtl=True,
    )

    with gr.Tab("💬 چت"):
        gr.ChatInterface(
            chat,
            type="messages",
            chatbot=gr.Chatbot(type="messages", height=480, rtl=True),
            textbox=gr.Textbox(placeholder="هر چی می‌خوای بپرس...", rtl=True, scale=7),
        )

    with gr.Tab("🖼️ عکس"):
        with gr.Row():
            with gr.Column():
                img_prompt = gr.Textbox(label="چه عکسی می‌خوای؟", lines=3, rtl=True,
                                        placeholder="مثلاً: یک پیرمرد خندان در بازار قدیمی تبریز، نور طبیعی عصر")
                img_size = gr.Radio(list(SIZES), value="مربع 1:1", label="اندازه")
                img_steps = gr.Slider(15, 50, value=30, step=1, label="کیفیت (تعداد مراحل)")
                img_seed = gr.Number(value=-1, label="Seed (‎-1 = تصادفی)", precision=0)
                img_btn = gr.Button("ساخت عکس", variant="primary")
            with gr.Column():
                img_out = gr.Image(label="نتیجه", type="filepath")
                img_used = gr.Textbox(label="متن انگلیسی استفاده‌شده", interactive=False)
        img_btn.click(make_image, [img_prompt, img_size, img_steps, img_seed], [img_out, img_used])

    with gr.Tab("🎬 ویدیو"):
        with gr.Row():
            with gr.Column():
                vid_prompt = gr.Textbox(label="چه ویدیویی می‌خوای؟", lines=3, rtl=True,
                                        placeholder="مثلاً: موج‌های دریا در غروب آفتاب کنار ساحل شمال")
                vid_secs = gr.Slider(2, 8, value=5, step=1, label="طول ویدیو (ثانیه)")
                vid_steps = gr.Slider(20, 50, value=30, step=1, label="کیفیت (تعداد مراحل)")
                vid_seed = gr.Number(value=-1, label="Seed (‎-1 = تصادفی)", precision=0)
                vid_btn = gr.Button("ساخت ویدیو", variant="primary")
            with gr.Column():
                vid_out = gr.Video(label="نتیجه")
                vid_used = gr.Textbox(label="متن انگلیسی استفاده‌شده", interactive=False)
        vid_btn.click(make_video, [vid_prompt, vid_secs, vid_steps, vid_seed], [vid_out, vid_used])

    with gr.Tab("🎵 آهنگ"):
        with gr.Row():
            with gr.Column():
                mus_prompt = gr.Textbox(label="چه آهنگی می‌خوای؟", lines=3, rtl=True,
                                        placeholder="مثلاً: موسیقی آرام سنتی ایرانی با تار و سنتور")
                mus_secs = gr.Slider(5, 30, value=15, step=1, label="طول آهنگ (ثانیه)")
                mus_btn = gr.Button("ساخت آهنگ", variant="primary")
            with gr.Column():
                mus_out = gr.Audio(label="نتیجه", type="filepath")
                mus_used = gr.Textbox(label="متن انگلیسی استفاده‌شده", interactive=False)
        mus_btn.click(make_music, [mus_prompt, mus_secs], [mus_out, mus_used])

    gr.Markdown(f"فایل‌های ساخته‌شده در پوشه `{OUTPUT_DIR}` ذخیره می‌شوند.", rtl=True)


if __name__ == "__main__":
    demo.queue().launch(inbrowser=True, server_name="127.0.0.1")
