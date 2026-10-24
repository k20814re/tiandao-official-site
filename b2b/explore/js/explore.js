'use strict';

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];

function activateTab(tab) {
  const route = tab.dataset.route;
  tabs.forEach(item => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  });
  panels.forEach(panel => {
    const active = panel.dataset.panel === route;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else next = (index - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    activateTab(tabs[next]);
  });
});

document.querySelectorAll('[data-guide]').forEach(button => {
  button.addEventListener('click', () => {
    const detail = document.getElementById(`guide-${button.dataset.guide}`);
    const open = detail.hidden;
    detail.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('span').textContent = open ? '−' : '＋';
  });
});

const header = document.querySelector('.site-header');
const setHeaderState = () => header.classList.toggle('scrolled', window.scrollY > 24);
setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });

const menuButton = document.querySelector('.menu-toggle');
const menu = document.getElementById('primary-nav');
menuButton.addEventListener('click', () => {
  const open = menu.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
});
menu.addEventListener('click', event => {
  if (event.target.closest('a')) {
    menu.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
});
