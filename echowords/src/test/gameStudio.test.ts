import { describe, expect, it } from 'vitest';
import { extractHtml, gameTitle, isAbcCommand, stripPromptCode, wantsPromptCode } from '../lib/gameStudio';

describe('game studio helpers', () => {
  it('/ABC and /Prompt Code', () => {
    expect(isAbcCommand('/ABC')).toBe(true);
    expect(isAbcCommand(' /abc ')).toBe(true);
    expect(isAbcCommand('/ABCD')).toBe(false);
    expect(wantsPromptCode('یک بازی ماشین بساز /Prompt Code')).toBe(true);
    expect(wantsPromptCode('یک بازی ماشین بساز /prompt code')).toBe(true);
    expect(wantsPromptCode('یک بازی ماشین بساز')).toBe(false);
    expect(stripPromptCode('یک بازی ماشین بساز /Prompt Code')).toBe('یک بازی ماشین بساز');
  });
  it('pulls the HTML out of the answer', () => {
    const doc = '<!DOCTYPE html><html><head><title>گربه و ستاره</title></head><body><script>1</script></body></html>';
    expect(extractHtml(doc)).toEqual({ html: doc, incomplete: false });
    expect(extractHtml('Here you go:\n```html\n' + doc + '\n```\nHave fun!')).toEqual({ html: doc, incomplete: false });
    expect(extractHtml('```html\n<!DOCTYPE html><html><body><script>let x = 1')!.incomplete).toBe(true);
    expect(extractHtml('Sorry, I cannot do that.')).toBeNull();
    expect(gameTitle(doc, 'x')).toBe('گربه و ستاره');
    expect(gameTitle('<html></html>', 'یک بازی')).toBe('یک بازی');
  });
});
