export function initAudio() {
  function formatTime(value: number) {
    const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  const player = document.querySelector<HTMLElement>('[data-audio-player]');
  if (player) {
    const audio = player.querySelector<HTMLAudioElement>('audio');
    const controls = player.querySelector<HTMLElement>('.player')!;
    const button = controls.querySelector<HTMLButtonElement>('button')!;
    const seek = controls.querySelector<HTMLInputElement>('input')!;
    const output = controls.querySelector('output')!;
    const message = player.querySelector<HTMLElement>('[data-audio-status]')!;
    const demo = !audio;
    let duration = Number(player.dataset.duration);
    let position = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    function sync() {
      if (audio) position = audio.currentTime;
      seek.max = String(duration);
      seek.value = String(position);
      output.textContent = `${formatTime(position)} / ${formatTime(duration)}`;
      seek.setAttribute(
        'aria-valuetext',
        `${formatTime(position)}，共 ${formatTime(duration)}`,
      );
      const playing = demo ? timer !== undefined : !audio!.paused;
      button.textContent = playing
        ? demo
          ? '暂停演示'
          : '暂停'
        : demo
          ? '播放演示'
          : '播放';
      button.setAttribute('aria-pressed', String(playing));
    }
    function stopDemo() {
      clearInterval(timer);
      timer = undefined;
      sync();
    }
    button.addEventListener('click', async () => {
      if (audio) {
        if (!audio.paused) audio.pause();
        else {
          try {
            await audio.play();
            message.hidden = true;
          } catch {
            message.hidden = false;
            message.textContent =
              '暂时无法播放，请稍后重试，或使用下方原生播放器。';
            audio.hidden = false;
          }
        }
      } else if (timer !== undefined) stopDemo();
      else {
        if (position >= duration) position = 0;
        timer = setInterval(() => {
          position = Math.min(duration, position + 1);
          if (position >= duration) stopDemo();
          sync();
        }, 1000);
        sync();
      }
    });
    function jump(value: number) {
      if (audio) {
        if (audio.readyState >= 1) audio.currentTime = value;
        else {
          audio.addEventListener(
            'loadedmetadata',
            () => {
              audio.currentTime = value;
              sync();
            },
            { once: true },
          );
          audio.load();
        }
      }
      position = value;
      sync();
    }
    seek.addEventListener('input', () => jump(Number(seek.value)));
    document
      .querySelectorAll<HTMLButtonElement>('.chapter')
      .forEach((chapter) =>
        chapter.addEventListener('click', () =>
          jump(Number(chapter.dataset.time)),
        ),
      );
    if (audio) {
      audio.hidden = true;
      controls.hidden = false;
      button.textContent = '播放';
      for (const event of ['timeupdate', 'play', 'pause', 'ended'])
        audio.addEventListener(event, sync);
      audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio.duration)) duration = audio.duration;
        sync();
      });
      audio.addEventListener('error', () => {
        message.hidden = false;
        message.textContent = '音频暂时无法载入，请稍后重试。';
        audio.hidden = false;
      });
    }
    window.addEventListener('pagehide', () => {
      stopDemo();
      audio?.pause();
    });
    sync();
  }
}
