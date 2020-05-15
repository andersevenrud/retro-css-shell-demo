/**
 * AnderShell - Just a small CSS demo
 *
 * Copyright (c) 2011-2018, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Creates initial options
const createOptions = opts => Object.assign({}, {
  banner: 'Hello World',
  prompt: () => '$ > ',
  tickrate: 1000 / 60,
  buflen: 8,
  commands: {}
}, opts || {});

// Creates our textarea element
const createElement = root => {
  const el = document.createElement('textarea');
  el.contentEditable = true;
  el.spellcheck = false;
  el.value = '';

  root.appendChild(el);
  document.body.ontouchend = function() { el.focus(); };

  return el;
};

// Keys that must be ignored

// Sets text selection range
const setSelectionRange = input => {
  const length = input.value.length;

  if (input.setSelectionRange) {
    input.focus();
    input.setSelectionRange(length, length);
  } else if (input.createTextRange) {
    const range = input.createTextRange();
    range.collapse(true);
    range.moveEnd('character', length);
    range.moveStart('character', length);
    range.select();
  }
};

// Gets the font size of an element
const getFontSize = element => parseInt(window.getComputedStyle(element)
  .getPropertyValue('font-size'), 10);

// Creates the rendering loop
const renderer = (tickrate, onrender) => {
  let lastTick = 0;

  const tick = (time) => {
    const now = performance.now();
    const delta = now - lastTick;

    if (delta > tickrate) {
      lastTick = now - (delta % tickrate);

      onrender();
    }

    window.requestAnimationFrame(tick);
  };

  return tick;
};

// Pronts buffer onto the textarea
const printer = ($element, buflen) => buffer => {
  if (buffer.length > 0) {
    const len = Math.min(buflen, buffer.length);
    const val = buffer.splice(0, len);

    $element.value += val.join('');

    setSelectionRange($element);
    $element.scrollTop = $element.scrollHeight;

    return true;
  }

  return false;
};

// Parses input
const parser = onparsed => str => {
  if (str.length) {
    const args = str.split(' ').map(s => s.trim());
    const cmd = args.splice(0, 1)[0];
    console.debug(cmd, args);
    onparsed(cmd, ...args);
  }
};

// Command executor
const executor = commands => (cmd, ...args) => cb => {
  try {
    commands[cmd]
      ? cb(commands[cmd](...args) + '\n')
      : cb(`No such command '${cmd}'\n`);
  } catch (e) {
    console.warn(e);
    cb(`Exception: ${e}\n`);
  }
};

// Handle keyboard events
const keyboard = ($element, prompt, parse) => {
  let input = [];
  const keys = {8: 'backspace', 13: 'enter'};
  const ignoreKey = code => code >= 33 && code <= 40;
  const key = ev => keys[ev.which || ev.keyCode];

  return {
    keypress: (ev) => {
      if (key(ev) === 'enter') {
        const str = input.join('').trim();
        parse(str || $element.value.split(/\n/)[$element.value.split(/\n/).length - 1].replace(prompt(), ''));
        input = [];
      } else if (key(ev) !== 'backspace') {
        input.push(String.fromCharCode(ev.which || ev.keyCode));
      }
    },

    keydown: (ev) => {
      if (key(ev) === 'backspace') {
        if (input.length > 0) {
          input.pop();
        } else {
          ev.preventDefault();
        }
      } else if (ignoreKey(ev.keyCode)) {
        ev.preventDefault();
      }
    }
  };
};

// Creates the terminal
export const terminal = (opts) => {
  let buffer = []; // What will be output to display
  let busy = false; // If we cannot type at the moment

  const {prompt, banner, commands, buflen, tickrate} = createOptions(opts);
  const $root = document.querySelector('#terminal');
  const $element = createElement($root);
  const fontSize = getFontSize($element);
  const width = $element.offsetWidth;
  const cwidth = Math.round((width / fontSize) * 1.9); // FIXME: Should be calculated via canvas

  const output = (output, center) => {
    let lines = output.split(/\n/);
    if (center) {
      lines = lines.map(line => line.length > 0
        ? line.padStart(line.length + ((cwidth / 2) - (line.length / 2)), ' ')
        : line);
    }

    const append = lines.join('\n') + '\n' + prompt();
    buffer = buffer.concat(append.split(''));
  };

  const print = printer($element, buflen);
  const execute = executor(commands);
  const onrender = () => (busy = print(buffer));
  const onparsed = (cmd, ...args) => execute(cmd, ...args)(output);
  const render = renderer(tickrate, onrender);
  const parse = parser(onparsed);
  const focus = () => setTimeout(() => $element.focus(), 1);
  const kbd = keyboard($element, prompt, parse);
  const clear = () => ($element.value = '');
  const input = ev => busy
    ? ev.preventDefault()
    : kbd[ev.type](ev);

  $element.addEventListener('focus', () => setSelectionRange($element));
  $element.addEventListener('blur', focus);
  $element.addEventListener('keypress', input);
  $element.addEventListener('keydown', input);
  window.addEventListener('focus', focus);
  $root.addEventListener('click', focus);
  $root.appendChild($element);

  render();
  output(banner, true);
  focus();

  return {focus, parse, clear, print: output};
};
