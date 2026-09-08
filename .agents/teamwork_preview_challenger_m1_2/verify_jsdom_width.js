const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const window = dom.window;

console.log("Initial window.innerWidth:", window.innerWidth);
window.innerWidth = 500;
console.log("After window.innerWidth = 500:", window.innerWidth);

Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
console.log("After Object.defineProperty innerWidth 500:", window.innerWidth);
