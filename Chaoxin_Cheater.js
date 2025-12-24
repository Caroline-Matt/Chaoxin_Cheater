(function () {
  const startBanner = () => console.log("%c=== 开始刷课 ===", "color:#4CAF50;font-size:16px;font-weight:bold");
  const setErrorHooks = () => {
    window.addEventListener("error", e => console.error("[刷课错误]", e.message || e, e.error || ""));
    window.addEventListener("unhandledrejection", e => console.error("[刷课错误] Promise", e.reason || e));
  };

  const boot = () => {
    const $ = window.jQuery;
    setErrorHooks();
    startBanner();

    const cfg = { dragTries: 2, maxRates: [16, 8, 4, 2], checkInterval: 1200 };

    const getPlayerDoc = () => {
      try {
        const outer = $("#iframe");
        if (outer.length) {
          const inner = outer.contents().find("iframe.ans-insertvideo-online").eq(0);
          if (inner.length) return inner.contents();
        }
        const direct = $("iframe.ans-insertvideo-online").eq(0);
        return direct.length ? direct.contents() : null;
      } catch (_) { return null; }
    };
    const getVideoFrame = () => {
      try {
        const outer = $("#iframe");
        if (outer.length) {
          const inner = outer.contents().find("iframe.ans-insertvideo-online").eq(0);
          if (inner.length) return inner.get(0);
        }
        const direct = $("iframe.ans-insertvideo-online").eq(0);
        return direct.length ? direct.get(0) : null;
      } catch (_) { return null; }
    };
    const getVideo = () => {
      const doc = getPlayerDoc();
      return doc ? doc.find("video#video_html5_api, video").get(0) : null;
    };
    const getVideoPlayer = () => {
      const frame = getVideoFrame();
      if (!frame) return null;
      try { return frame.contentWindow.videojs && frame.contentWindow.videojs("video"); } catch (_) { return null; }
    };
    const getProgressHandle = () => {
      const doc = getPlayerDoc();
      return doc ? doc.find(".vjs-progress-holder, .vjs-slider, .vjs-play-progress").last() : null;
    };

    const dragToEnd = async () => {
      const handle = getProgressHandle();
      if (!handle || handle.length === 0) return false;
      const el = handle.get(0);
      const rect = el.getBoundingClientRect();
      const x = rect.right - 2, y = (rect.top + rect.bottom) / 2;
      ["mousedown", "mousemove", "mouseup"].forEach(t =>
        el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
      );
      console.log("尝试拖动进度条到末尾");
      await new Promise(r => setTimeout(r, 800));
      const v = getVideo();
      return v ? v.currentTime / v.duration > 0.98 : false;
    };

    // 强化答题：成功必须有继续/SpanHas；继续按钮多次强点
    const answerQuiz = () => {
      const doc = getPlayerDoc();
      if (!doc) return;
      const quiz = doc.find(".ans-videoquiz:visible, .popboxes:visible, .quesItem:visible, .prompt-body:visible, .topic-box:visible").last();
      if (!quiz.length) return;

      const opts = quiz.find(".ans-videoquiz-opt input[type=radio], .ans-videoquiz-opt input[type=checkbox]");
      const genericOpts = quiz.find("input[type=checkbox], input[type=radio]");
      const options = (opts.length ? opts : genericOpts).toArray();
      if (!options.length) return;

      const combos = [];
      for (let i = 0; i < options.length; i++) combos.push([options[i]]);
      if (options.length >= 2) combos.push([options[0], options[1]]);
      if (options.length >= 3) combos.push([options[0], options[1], options[2]]);
      if (options.length >= 4) combos.push([options[0], options[1], options[2], options[3]]);

      const submitBtn = quiz.find("#videoquiz-submit:visible, button:contains('提交'), .btn-submit, .blueBtn").first();
      const continueBtn = () => quiz.find("#videoquiz-continue:visible, .ans-videoquiz-continue:visible").first();

      const forceClickContinue = (tries = 0) => {
        const c = continueBtn();
        if (c.length) {
          const el = c.get(0);
          ["click", "mousedown", "mouseup"].forEach(ev =>
            el.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true }))
          );
          c.trigger("click");
          console.log("[quiz] continue clicked");
          return true;
        }
        if (tries >= 12) return false;
        setTimeout(() => forceClickContinue(tries + 1), 200);
        return false;
      };

      const clickSubmit = () => {
        if (!submitBtn.length) return;
        console.log("[quiz] click submit");
        submitBtn.get(0).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      };

      const selectCombo = (arr, idx) => {
        options.forEach(o => { o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); });
        arr.forEach(o => {
          const lbl = $(o).closest("label");
          lbl.length ? lbl.click() : o.click();
        });
        console.log("[quiz] select combo", idx + 1, "/", combos.length);
      };

      const checkResult = () => {
        const c = continueBtn().length > 0;
        const hasSpanHas = quiz.find("#spanHas:visible").length > 0;
        const txt = quiz.text();
        const maybeCorrect = txt.includes("答对") || txt.includes("正确");
        const maybeWrong = txt.includes("遗憾") || txt.includes("错误") || quiz.find("#spanNot:visible, #spanNotBack:visible, #spanNotBackPoint:visible").length > 0;
        const success = c || hasSpanHas;              // 必须有继续/SpanHas
        const fail = maybeWrong || (maybeCorrect && !success);
        console.log("[quiz] check", { success, fail, c, hasSpanHas, maybeCorrect, maybeWrong });
        return { success, fail };
      };

      const tryCombo = (i) => {
        if (forceClickContinue()) return;
        if (i >= combos.length) { console.log("[quiz] combos exhausted"); return; }
        selectCombo(combos[i], i);
        clickSubmit();

        let polls = 0;
        const poll = () => {
          if (forceClickContinue()) return;
          const { success, fail } = checkResult();
          if (success) { forceClickContinue(); return; }
          if (fail || polls >= 4) {
            console.log("[quiz] switch combo", i + 2);
            tryCombo(i + 1);
            return;
          }
          polls++;
          setTimeout(poll, 350);
        };
        setTimeout(poll, 450);
      };

      tryCombo(0);
    };

    const setMaxRate = (video) => {
      const player = getVideoPlayer();
      for (const r of cfg.maxRates) {
        try {
          if (player) {
            player.playbackRate(r);
            if (player.playbackRate() === r) { console.log("倍速成功:", r); return true; }
          } else {
            video.playbackRate = r;
            if (video.playbackRate === r) { console.log("倍速成功:", r); return true; }
          }
        } catch (_) {}
      }
      return false;
    };

    const forcePlay = (video) => video && video.play().catch(() => {
      const doc = getPlayerDoc();
      const btn = doc ? doc.find(".vjs-big-play-button").first() : null;
      btn && btn.click();
    });

    const playNext = () => {
      const tree = $("#coursetree");
      const act = tree.find(".posCatalog_active");
      if (!act.length) return;
      const list = tree.find(".posCatalog_select:not(.firstLayer)");
      const idx = list.index(act);
      const next = list.get(idx + 1);
      if (next) {
        $(next).find(".posCatalog_name").click();
        console.log("切换下一节");
        setTimeout(startPlay, 3000);
      } else {
        console.log("%c刷课结束", "color:#4CAF50;font-size:14px;font-weight:bold");
      }
    };

    const startPlay = async () => {
      try {
        const v = getVideo();
        const player = getVideoPlayer();
        if (!v) {
          console.log("未找到视频，2s后重试");
          return setTimeout(startPlay, 2000);
        }

        try { player ? player.muted(true) : (v.muted = true); } catch (_) { v.muted = true; }

        let ok = false;
        for (let i = 0; i < cfg.dragTries; i++) {
          ok = await dragToEnd();
          if (ok) break;
        }
        if (!ok) {
          setMaxRate(v);
          try { v.currentTime = Math.max(0, v.duration - 2); } catch (_) {}
        }

        forcePlay(v);

        const watcher = setInterval(() => {
          try {
            answerQuiz();
            if (v.paused) forcePlay(v);
            if (v.ended || v.currentTime >= v.duration - 0.8) {
              clearInterval(watcher);
              console.log("视频结束，准备下一节");
              setTimeout(playNext, 1000);
            }
          } catch (err) {
            console.error("[刷课错误] watcher", err);
          }
        }, cfg.checkInterval);

        window.addEventListener("blur", () => forcePlay(v));
        window.addEventListener("mouseout", () => forcePlay(v));
      } catch (err) {
        console.error("[刷课错误] startPlay", err);
      }
    };

    startPlay();
  };

  if (!window.jQuery) {
    const s = document.createElement("script");
    s.src = "https://code.jquery.com/jquery-3.6.0.min.js";
    s.onload = boot;
    document.head.appendChild(s);
  } else {
    boot();
  }
})();
