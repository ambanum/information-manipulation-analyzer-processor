import { sanitizeHashtag } from './sanitizer';

const hashtagTests = [
  ['<SCRIPT SRC=http://xss.rocks/xss.js></SCRIPT>', 'scriptsrchttpxssrocksxssjsscript'],
  ['<IMG SRC="javascript:alert(\'XSS\');">', 'imgsrcjavascriptalertxss'],
  ['javascript:alert("ok")', 'javascriptalertok'],
  [
    'perl -e \'print "<IMG SRC=java\0script:alert("XSS")>";\' > out',
    'perleprintimgsrcjavascriptalertxssout',
  ],
  ['Set.constructor`alert\x28document.domain\x29', 'setconstructoralertdocumentdomain'],
  ['ok', 'ok'],
  ['Super', 'super'],
  ['فرنسا_الإرهابية', 'فرنسا_الإرهابية'],
  ['Xoроший', 'xoроший'],
];

test('deep', () => {
  hashtagTests.forEach(([name, sanitizedName]) =>
    expect(sanitizeHashtag(name)).toBe(sanitizedName)
  );
});
