(function () {
  const startBanner = () => console.log("%c=== 开始刷课 ===", "color:#4CAF50;font-size:16px;font-weight:bold");
  const setErrorHooks = () => {
    window.addEventListener("error", e => console.error("[刷课错误]", e.message || e, e.error || ""));
    window.addEventListener("unhandledrejection", e => console.error("[刷课错误] Promise", e.reason || e));
  };

  const boot = () => {
    const $ = window.jQuery; setErrorHooks(); startBanner();
    const cfg = { maxRates: [16, 8, 4, 2], checkInterval: 1200 };
    let dragDisabled = false, advancing = false;

    const getPlayerDoc = () => { try { const o=$("#iframe"); if(o.length){const i=o.contents().find("iframe.ans-insertvideo-online").eq(0); if(i.length) return i.contents();} const d=$("iframe.ans-insertvideo-online").eq(0); return d.length?d.contents():null;} catch(_) {return null;} };
    const getVideoFrame = () => { try { const o=$("#iframe"); if(o.length){const i=o.contents().find("iframe.ans-insertvideo-online").eq(0); if(i.length) return i.get(0);} const d=$("iframe.ans-insertvideo-online").eq(0); return d.length?d.get(0):null;} catch(_) {return null;} };
    const getVideo = () => { const doc=getPlayerDoc(); return doc?doc.find("video#video_html5_api, video").get(0):null; };
    const getPlayer = () => { const f=getVideoFrame(); if(!f) return null; try{return f.contentWindow.videojs&&f.contentWindow.videojs("video");}catch(_){return null;} };
    const getHandle = () => { const doc=getPlayerDoc(); return doc?doc.find(".vjs-progress-holder, .vjs-progress-control, .vjs-slider, .vjs-play-progress, .vjs-seek-handle").last():null; };

    const dragByEvent = async () => { const h=getHandle(); if(!h||!h.length) return false; const el=h.get(0), r=el.getBoundingClientRect(), x=r.right-2, y=(r.top+r.bottom)/2;
      ["mousedown","mousemove","mouseup"].forEach(t=>el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y})));
      await new Promise(rp=>setTimeout(rp,300)); const v=getVideo(); return v? v.currentTime/v.duration>0.98 : false; };
    const forceSeek = () => { try{const v=getVideo(), p=getPlayer(); if(!v) return false; const t=Math.max(0,v.duration-1); let ok=false;
        try{v.currentTime=t; ok=true;}catch(_){} try{ if(p){p.currentTime(t); ok=true;} }catch(_){} return ok&&v.currentTime>=t-1;
      }catch(_){return false;} };
    const handleDrag = async (video) => {
      if(dragDisabled){ setMaxRate(video); return; }
      const ok = await (async()=>{
        if(await dragByEvent()) return true;
        await new Promise(r=>setTimeout(r,500));
        if(await dragByEvent()) return true;
        if(forceSeek()) return true;
        return false;
      })();
      if(!ok){ dragDisabled=true; console.log("[drag] 失败，后续停拖动改倍速"); setMaxRate(video); }
      else console.log("[drag] 成功拖动/硬设");
    };

    const setMaxRate = (v) => { const p=getPlayer(); for (const r of cfg.maxRates){ try{ if(p){p.playbackRate(r); if(p.playbackRate()===r){console.log("倍速成功:",r); return true;}} else {v.playbackRate=r; if(v.playbackRate===r){console.log("倍速成功:",r); return true;}} }catch(_){} } return false; };
    const forcePlay = (v)=> v && v.play().catch(()=>{ const doc=getPlayerDoc(); const btn=doc?doc.find(".vjs-big-play-button").first():null; btn&&btn.click(); });

    const advanceNext = () => {
      if(advancing) return; advancing=true;
      const btn=document.querySelector("#prevNextFocusNext");
      if(btn){ ["click","mousedown","mouseup"].forEach(ev=>btn.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true}))); console.log("点击下一节按钮"); }
      else {
        const tree=$("#coursetree"), act=tree.find(".posCatalog_active");
        if(act.length){ const list=tree.find(".posCatalog_select:not(.firstLayer)"), idx=list.index(act), next=list.get(idx+1);
          if(next){ $(next).find(".posCatalog_name").click(); console.log("目录兜底切换下一节"); }
          else console.log("无下一节");
        } else console.log("未找到下一节按钮或当前节点");
      }
      setTimeout(()=>{ advancing=false; startPlay(); },2000);
    };

    const answerQuiz = () => {
      const doc=getPlayerDoc(); if(!doc) return;
      const quiz=doc.find(".ans-videoquiz:visible, .popboxes:visible, .quesItem:visible, .prompt-body:visible, .topic-box:visible").last(); if(!quiz.length) return;
      const opts=quiz.find(".ans-videoquiz-opt input[type=radio], .ans-videoquiz-opt input[type=checkbox]"); const gen=quiz.find("input[type=checkbox], input[type=radio]");
      const options=(opts.length?opts:gen).toArray(); if(!options.length) return;
      const combos=[]; for(let i=0;i<options.length;i++) combos.push([options[i]]);
      if(options.length>=2) combos.push([options[0],options[1]]);
      if(options.length>=3) combos.push([options[0],options[1],options[2]]);
      if(options.length>=4) combos.push([options[0],options[1],options[2],options[3]]);
      const submitBtn=quiz.find("#videoquiz-submit:visible, button:contains('提交'), .btn-submit, .blueBtn").first();
      const continueBtn=()=>quiz.find("#videoquiz-continue:visible, .ans-videoquiz-continue:visible").first();
      const forceClickContinue=(t=0)=>{ const c=continueBtn(); if(c.length){ const el=c.get(0); ["click","mousedown","mouseup"].forEach(ev=>el.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true}))); c.trigger("click"); return true; } if(t>=12) return false; setTimeout(()=>forceClickContinue(t+1),200); return false; };
      const clickSubmit=()=>{ if(!submitBtn.length) return; submitBtn.get(0).dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true})); };
      const selectCombo=(arr)=>{ options.forEach(o=>{o.checked=false; o.dispatchEvent(new Event("change",{bubbles:true}));}); arr.forEach(o=>{const lbl=$(o).closest("label"); lbl.length?lbl.click():o.click();}); };
      const checkResult=()=>{ const c=continueBtn().length>0, spanHas=quiz.find("#spanHas:visible").length>0;
        const txt=quiz.text(), maybeCorrect=txt.includes("答对")||txt.includes("正确"), maybeWrong=txt.includes("遗憾")||txt.includes("错误")||quiz.find("#spanNot:visible,#spanNotBack:visible,#spanNotBackPoint:visible").length>0;
        return { success: c||spanHas, fail: maybeWrong || (maybeCorrect && !(c||spanHas)) }; };
      const afterSuccess=()=>{ const v=getVideo(); if(v){ try{v.currentTime=Math.max(0,v.duration-1);}catch(_){} v.play().catch(()=>{});} forceClickContinue(); };
      const tryCombo=(i)=>{ if(forceClickContinue()) return; if(i>=combos.length) return; selectCombo(combos[i]); clickSubmit();
        let polls=0; const poll=()=>{ if(forceClickContinue()) return;
          const {success,fail}=checkResult();
          if(success){ afterSuccess(); return; }
          if(fail||polls>=4){ tryCombo(i+1); return; }
          polls++; setTimeout(poll,350);
        }; setTimeout(poll,450);
      };
      tryCombo(0);
    };

    const startPlay = async () => {
      try{
        const v=getVideo(), p=getPlayer();
        if(!v){ console.log("未找到视频，2s后重试"); return setTimeout(startPlay,2000); }

        // 静音最高优先
        try{ p? p.muted(true) : (v.muted=true);}catch(_){ v.muted=true; }

        forcePlay(v);
        handleDrag(v);

        const watcher=setInterval(()=>{ try{
          answerQuiz();
          if(v.paused) forcePlay(v);
          if(v.ended || v.currentTime >= v.duration - 0.8){
            clearInterval(watcher);
            console.log("视频结束，准备下一节");
            setTimeout(advanceNext, 800);
          }
        }catch(err){ console.error("[刷课错误] watcher",err);} }, cfg.checkInterval);

        v.addEventListener("ended", ()=>{ console.log("ended事件触发，准备下一节"); setTimeout(advanceNext, 800); }, { once:true });

        window.addEventListener("blur", ()=>forcePlay(v));
        window.addEventListener("mouseout", ()=>forcePlay(v));
      }catch(err){ console.error("[刷课错误] startPlay", err); }
    };

    startPlay();
  };

  if(!window.jQuery){
    const s=document.createElement("script"); s.src="https://code.jquery.com/jquery-3.6.0.min.js"; s.onload=boot; document.head.appendChild(s);
  } else boot();
})();
