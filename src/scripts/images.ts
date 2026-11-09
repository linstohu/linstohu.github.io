export function initImages() {
  const dialog = document.querySelector<HTMLDialogElement>(
    '#article-image-dialog',
  );
  if (dialog) {
    document
      .querySelectorAll<HTMLButtonElement>('.image-open')
      .forEach((button) =>
        button.addEventListener('click', () => {
          const source = button.querySelector('img');
          const target = dialog.querySelector('img');
          if (!source || !target) return;
          target.src = source.currentSrc || source.src;
          target.alt = source.alt;
          const caption = dialog.querySelector('.image-caption');
          if (caption)
            caption.textContent =
              button.closest('figure')?.querySelector('figcaption')
                ?.textContent || source.alt;
          dialog.showModal();
        }),
      );
    dialog
      .querySelector('button')
      ?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
}
