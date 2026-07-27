/**
 * HelpOverlay Web Component
 * The objective/controls panel, shown with Esc or the Help button.
 *
 * Usage:
 *   const help = document.querySelector('help-overlay');
 *   help.toggle();
 *   help.addEventListener('close', () => { ... });
 *
 * CSS variables for customization (set on :host or a parent):
 *   --help-bg, --help-color, --help-accent, --help-border
 */

import { h } from '/src/domUtils.js';

const CSS = `
:host {
  --help-bg: #0f1424;
  --help-color: #f4f6ff;
  --help-accent: #00a0d1;
  --help-border: rgba(255, 255, 255, 0.16);

  dialog {
    width: min(30rem, calc(100vw - 2rem));
    margin: auto;
    padding: 0;
    box-sizing: border-box;
    color: var(--help-color);
    background-color: var(--help-bg);
    border: 1px solid var(--help-border);
    border-radius: 12px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  }

  ::backdrop {
    background-color: rgba(4, 6, 16, 0.66);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1em;
    padding: 1em 1.25em;
    border-bottom: 1px solid var(--help-border);

    h2 {
      margin: 0;
      font-size: 1.1em;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--help-accent);
    }
  }

  .content {
    padding: 1.25em;

    h3 {
      margin: 0 0 0.4em;
      font-size: 0.78em;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--help-accent);
    }

    p {
      margin: 0 0 1.25em;
      line-height: 1.5;
    }

    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5em 1em;
      margin: 0;
      align-items: baseline;
    }

    dt {
      font-weight: 600;
      white-space: nowrap;
    }

    dd {
      margin: 0;
      opacity: 0.85;
    }
  }

  footer {
    padding: 0 1.25em 1.25em;
  }

  .btn-close {
    width: 100%;
    padding: 0.7em 1.25em;
    font: inherit;
    font-weight: 600;
    color: #04121a;
    background-color: var(--help-accent);
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  .btn-close:hover {
    opacity: 0.9;
  }

  .btn-close:focus-visible {
    outline: 2px solid var(--help-color);
    outline-offset: 2px;
  }

  kbd {
    display: inline-block;
    padding: 0.15em 0.45em;
    font: inherit;
    font-size: 0.85em;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--help-border);
    border-radius: 5px;
  }

  dialog,
  ::backdrop {
    transition: opacity 0.2s allow-discrete;
    opacity: 0;
  }

  dialog[open],
  dialog[open]::backdrop {
    opacity: 1;
  }

  @starting-style {
    dialog[open],
    dialog[open]::backdrop {
      opacity: 0;
    }
  }
}
`;

const controls: ReadonlyArray<readonly [string, string]> = [
  ['Tap a tile', 'move the pivot there'],
  ['Swipe', 'shift that row or column'],
  ['Arrow keys', 'move the pivot'],
  ['I J K L', 'shift up / left / down / right'],
  ['R', 'restart the current level'],
  ['Esc', 'show or hide this panel'],
];

class HelpOverlay extends HTMLElement {
  #dialog: HTMLDialogElement | null = null;

  connectedCallback(): void {
    if (this.#dialog) return;

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(h('style', { textContent: CSS }));

    const definitions: HTMLElement[] = [];
    controls.forEach(([key, description]) => {
      definitions.push(h('dt', {}, [h('kbd', { innerText: key })]));
      definitions.push(h('dd', { innerText: description }));
    });

    const closeButton = h('button', {
      type: 'button',
      className: 'btn-close',
      innerText: 'Got it',
    });
    closeButton.addEventListener('click', () => this.close());

    this.#dialog = h('dialog', { closedby: 'any' }, [
      h('header', {}, [h('h2', { innerText: 'How to play' })]),
      h('div', { className: 'content' }, [
        h('h3', { innerText: 'Objective' }),
        h('p', {
          innerText:
            'Shift whole rows and columns until the board matches the GOAL pattern. ' +
            'Tiles wrap around as they slide off an edge.',
        }),
        h('h3', { innerText: 'Controls' }),
        h('dl', {}, definitions),
      ]),
      h('footer', {}, [closeButton]),
    ]) as HTMLDialogElement;

    this.#dialog.addEventListener('close', () => {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    });

    shadow.appendChild(this.#dialog);
  }

  get open(): boolean {
    return this.#dialog?.open ?? false;
  }

  show(): void {
    if (!this.#dialog?.open) this.#dialog?.showModal();
  }

  close(): void {
    if (this.#dialog?.open) this.#dialog.close();
  }

  toggle(): void {
    if (this.open) {
      this.close();
    } else {
      this.show();
    }
  }
}

customElements.define('help-overlay', HelpOverlay);

declare global {
  interface HTMLElementTagNameMap {
    'help-overlay': HelpOverlay;
  }
}

export default HelpOverlay;
