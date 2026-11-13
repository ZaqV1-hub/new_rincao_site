import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {CurrencyInput} from './currency-input';
it('preserves absence only when requested and still distinguishes an explicit zero',()=>{
  expect(renderToStaticMarkup(<CurrencyInput name="count" allowEmpty defaultValue=""/>)).toContain('value=""');
  expect(renderToStaticMarkup(<CurrencyInput name="count" allowEmpty defaultValue="0"/>)).toContain('value="0,00"');
  expect(renderToStaticMarkup(<CurrencyInput name="sale"/>)).toContain('value="0,00"');
});
