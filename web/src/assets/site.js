// The Listen section's read-along: plays George's John 1:1–2 and lights each word at the time the
// app's own alignment gives it (data-t, from jhn-001.json), as the app's player does. The audio is
// fetched only when the visitor presses play, since browsers refuse sound nobody started.
for (const figure of document.querySelectorAll(".readalong")) {
  const button = figure.querySelector(".ra-play");
  const label = figure.querySelector(".ra-label");
  const words = [...figure.querySelectorAll(".ra-text span[data-t]")];
  const times = words.map((w) => Number(w.dataset.t));
  let audio = null;
  let lit = -1;
  let frame = 0;

  const light = (index) => {
    if (index === lit) return;
    words[lit]?.classList.remove("ra-on");
    words[index]?.classList.add("ra-on");
    lit = index;
  };

  const tick = () => {
    const now = audio.currentTime;
    let index = -1;
    while (index + 1 < times.length && times[index + 1] <= now) index += 1;
    light(index);
    frame = requestAnimationFrame(tick);
  };

  const setPlaying = (playing) => {
    button.setAttribute("aria-pressed", String(playing));
    label.textContent = playing ? "Pause" : "Hear it";
    cancelAnimationFrame(frame);
    if (playing) frame = requestAnimationFrame(tick);
  };

  button.addEventListener("click", () => {
    if (audio === null) {
      audio = new Audio(figure.dataset.src);
      audio.addEventListener("play", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("ended", () => {
        light(-1);
        audio.currentTime = 0;
      });
    }
    if (audio.paused) audio.play();
    else audio.pause();
  });

  button.hidden = false;
}

// Read it your way: the CSS loop (30 s, 6 s a case) waits until the section is on screen, so a
// visitor meets Today first, and a case chosen by click, tap or Enter restarts the loop there.
for (const section of document.querySelectorAll(".yw")) {
  const cases = [...section.querySelectorAll(".yw-case")];

  const restartAt = (index) => {
    section.style.setProperty("--yw-o", `${index * 6}s`);
    section.classList.add("yw-reset");
    void section.offsetWidth; // a style flush, so removing the class starts the animations afresh
    section.classList.remove("yw-reset");
  };

  // The section is taller than a phone screen, so "on screen" is its middle third crossing the view.
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    start(0);
  }, { rootMargin: "-33% 0px" });

  const start = (index) => {
    observer.disconnect();
    section.classList.remove("yw-wait");
    restartAt(index);
  };

  section.classList.add("yw-wait");
  observer.observe(section);

  cases.forEach((item, index) => {
    item.setAttribute("role", "button");
    item.addEventListener("click", () => start(index));
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      item.click();
    });
  });
}

// Closer to the Greek: hover and keyboard focus already show a word's card (CSS). A click or tap
// picks the word, so on a phone, where there is no hover, its card stays until another is chosen.
for (const study of document.querySelectorAll(".study")) {
  const words = [...study.querySelectorAll(".word")];
  for (const word of words) {
    word.setAttribute("aria-pressed", "false");
    word.addEventListener("click", () => {
      for (const other of words) {
        other.classList.toggle("is-picked", other === word);
        other.setAttribute("aria-pressed", String(other === word));
      }
      for (const card of study.querySelectorAll(".wc")) {
        card.toggleAttribute("data-default", card.id === word.getAttribute("aria-describedby"));
      }
    });
  }
}

// Search, as in the app: the query types into the phone's own field, then the results come in
// down the screen. Runs only on screen and with motion allowed; otherwise the phone keeps the
// Nicodemus results as captured.
for (const demo of document.querySelectorAll(".search-demo")) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) continue;
  const field = demo.querySelector(".sd-q");
  const cover = demo.querySelector(".sd-cover");
  const shots = [...demo.querySelectorAll(".sd-shot")];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let visible = false;
  let running = false;

  const run = async () => {
    running = true;
    demo.classList.add("is-live");
    let index = 0;
    while (visible) {
      const shot = shots[index];
      cover.classList.remove("is-open");
      while (field.textContent.length > 0) {
        field.textContent = field.textContent.slice(0, -1);
        await wait(40);
      }
      for (const s of shots) s.classList.toggle("is-on", s === shot);
      await wait(300);
      for (const letter of shot.dataset.q) {
        field.textContent += letter;
        await wait(120);
      }
      await wait(300);
      cover.classList.add("is-open");
      await wait(4200);
      index = (index + 1) % shots.length;
    }
    running = false;
  };

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && !running) run();
  }, { rootMargin: "-20% 0px" }).observe(demo);
}

// Made for every day: each card has a moment when it first arrives (CSS keys off .is-in). The
// class on <html> holds the "before" state only when this script runs, so nothing hides without it.
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("js-moments");
  const arrive = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      arrive.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -25% 0px" });
  for (const card of document.querySelectorAll(".bc, .fact")) arrive.observe(card);

  // 57 of 100: the number counts up in step with the dots filling (16 ms a dot, as in the CSS).
  for (const fact of document.querySelectorAll(".fact")) {
    const count = fact.querySelector(".fact-count");
    const target = Number(count.textContent);
    count.textContent = "0";
    new IntersectionObserver((entries, observer) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const step = (now) => {
        const n = Math.min(target, Math.floor((now - start) / 16));
        count.textContent = String(n);
        if (n < target) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { rootMargin: "0px 0px -25% 0px" }).observe(fact);
  }
}
