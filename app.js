(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const canvas = $('#motion-canvas'), ctx = canvas.getContext('2d');
  const input = $('#cover-input'), upload = $('#upload-button'), exportButton = $('#export-button');
  const feedback = $('#feedback'), pauseButton = $('#preview-pause');
  const descriptions = {
    drift: 'Медленный наезд и мягкое скольжение. Для музыки, в которой хочется остаться.',
    pulse: 'Ритмичный наезд и тёплая вспышка. Визуальный пульс без привязки к аудио.',
    film: 'Лёгкое покачивание, зерно и световые засветки. Как найденный фрагмент плёнки.'
  };
  let image = null, mood = 'drift', paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let recording = false, custom = false, elapsed = 0, previous = 0, tick = 0;
  let loadVersion = 0, sourceUrl = null, exportTimer = null, recorder = null, exportStream = null, abortExport = null;
  const grain = document.createElement('canvas'); grain.width = 180; grain.height = 320;
  const gctx = grain.getContext('2d'), pixels = gctx.createImageData(180,320);
  for(let i=0;i<pixels.data.length;i+=4){const v=Math.random()*255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=28;}
  gctx.putImageData(pixels,0,0);
  const hero = $('.hero-art'), heroPause = $('.hero-pause');
  if(paused) hero.classList.add('paused');
  function playbackIcon(isPaused){return isPaused?'<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7z"/></svg>':'<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';}
  function syncPause(){pauseButton.innerHTML=playbackIcon(paused);pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.setAttribute('aria-label',paused?'Включить предпросмотр':'Приостановить предпросмотр');}
  function syncHero(){const p=hero.classList.contains('paused');heroPause.innerHTML=playbackIcon(p);heroPause.setAttribute('aria-pressed',String(p));heroPause.setAttribute('aria-label',p?'Включить анимацию примера':'Приостановить анимацию примера');}
  syncPause();syncHero();
  heroPause.addEventListener('click',()=>{hero.classList.toggle('paused');syncHero();});
  pauseButton.addEventListener('click',()=>{if(recording)return;paused=!paused;syncPause();});
  function draw(time){
    if(!image || !ctx)return;
    const w=canvas.width,h=canvas.height,t=(time%6)/6,cycle=Math.sin(t*Math.PI*2);
    let zoom=1.08+0.04*cycle,dx=cycle*12,dy=Math.cos(t*Math.PI*2)*7,rotation=0;
    if(mood==='pulse'){zoom=1.07+0.05*(.5+.5*Math.cos(t*Math.PI*8));dx=0;dy=0;}
    if(mood==='film'){zoom=1.1;dx=cycle*9;dy=Math.sin(t*Math.PI*4)*6;rotation=cycle*.008;}
    ctx.save();ctx.fillStyle='#141610';ctx.fillRect(0,0,w,h);ctx.translate(w/2+dx,h/2+dy);ctx.rotate(rotation);
    const cover=Math.max(w/image.naturalWidth,h/image.naturalHeight)*zoom;
    const iw=image.naturalWidth*cover,ih=image.naturalHeight*cover;
    ctx.drawImage(image,-iw/2,-ih/2,iw,ih);ctx.restore();
    if(mood==='pulse'){ctx.fillStyle=`rgba(238,80,41,${.035+.055*(.5+.5*Math.sin(t*Math.PI*8))})`;ctx.fillRect(0,0,w,h);}
    if(mood==='film'){
      ctx.save();ctx.globalAlpha=.65;ctx.drawImage(grain,(Math.floor(time*12)%3-1)*15,0,w+30,h);ctx.restore();
      const leak=ctx.createLinearGradient(0,0,w,0);leak.addColorStop(0,`rgba(238,80,41,${.04+.1*(.5+.5*cycle)})`);leak.addColorStop(.4,'transparent');leak.addColorStop(1,'rgba(239,211,151,.04)');ctx.fillStyle=leak;ctx.fillRect(0,0,w,h);
    }
    if(!custom){
      const shade=ctx.createLinearGradient(0,h*.5,0,h);shade.addColorStop(0,'transparent');shade.addColorStop(1,'rgba(0,0,0,.75)');ctx.fillStyle=shade;ctx.fillRect(0,h*.5,w,h*.5);
      ctx.fillStyle='#f4f0e7';ctx.font='500 20px Arial';ctx.fillText('SIDE A / 001',44,62);
      ctx.font='bold 88px Arial';ctx.fillText('AFTER',42,h-265);ctx.fillText('THE SUN',42,h-170);
      ctx.font='17px Arial';ctx.fillText('FICTIONAL RELEASE / DEMO',46,h-126);
    }
  }
  function loop(now){
    if(previous && !document.hidden && (!paused||recording))elapsed+=Math.min((now-previous)/1000,.1);
    previous=now;if(now-tick>32){draw(elapsed);tick=now;}requestAnimationFrame(loop);
  }
  function chosenMime(){if(!window.MediaRecorder)return '';return ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(v=>MediaRecorder.isTypeSupported(v))||'';}
  function updateExport(){
    const supported=!!window.MediaRecorder&&typeof canvas.captureStream==='function'&&!!chosenMime();
    exportButton.disabled=!image||!supported;
    if(!supported)$('#export-note').textContent='Запись недоступна в этом браузере. Посмотреть демо можно; для скачивания попробуйте актуальный Chrome или Edge.';
    else $('#export-note').textContent='Видео '+(chosenMime().includes('mp4')?'MP4':'WebM')+' · 720 × 1280 · запись в браузере';
  }
  function loadDefault(){
    const version=++loadVersion,img=new Image();
    img.onload=()=>{if(version!==loadVersion)return;if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}image=img;custom=false;elapsed=0;$('#preview-caption').textContent='AFTER THE SUN — пример';$('#file-note').textContent='Картинка остаётся в вашем браузере.';$('#reset-button').hidden=true;input.value='';feedback.textContent='';updateExport();draw(0);};
    img.onerror=()=>{feedback.textContent='Пример не загрузился. Выберите свою обложку.';};img.src='assets/eclipse.webp';
  }
  function loadFile(file){
    if(!file||recording)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){feedback.textContent='Выберите изображение JPG, PNG или WebP.';input.value='';return;}
    if(file.size>10*1024*1024){feedback.textContent='Файл больше 10 МБ. Попробуйте уменьшить изображение.';input.value='';return;}
    const version=++loadVersion,url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      if(version!==loadVersion){URL.revokeObjectURL(url);return;}
      if(img.naturalWidth>12000||img.naturalHeight>12000){URL.revokeObjectURL(url);feedback.textContent='Слишком большое разрешение. Уменьшите сторону картинки до 12 000 пикселей.';return;}
      if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=url;image=img;custom=true;elapsed=0;
      $('#preview-caption').textContent='Ваша обложка — '+file.name;$('#file-note').textContent=file.name+' · открыто локально';$('#reset-button').hidden=false;
      feedback.textContent='Обложка готова. Выберите движение и скачайте пример.';updateExport();draw(0);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);if(version!==loadVersion)return;feedback.textContent='Не удалось прочитать изображение. Попробуйте другой JPG, PNG или WebP.';input.value='';};img.src=url;
  }
  upload.addEventListener('click',()=>input.click());input.addEventListener('change',()=>loadFile(input.files[0]));
  upload.addEventListener('dragover',e=>{e.preventDefault();upload.classList.add('drag-over');});
  upload.addEventListener('dragleave',()=>upload.classList.remove('drag-over'));
  upload.addEventListener('drop',e=>{e.preventDefault();upload.classList.remove('drag-over');loadFile(e.dataTransfer.files[0]);});
  $('#reset-button').addEventListener('click',loadDefault);
  document.querySelectorAll('[data-mood]').forEach(button=>button.addEventListener('click',()=>{if(recording)return;mood=button.dataset.mood;elapsed=0;document.querySelectorAll('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#mood-description').textContent=descriptions[mood];draw(0);}));
  function lock(value){recording=value;upload.disabled=value;pauseButton.disabled=value;$('#reset-button').disabled=value;document.querySelectorAll('[data-mood]').forEach(b=>b.disabled=value);exportButton.disabled=value;if(!value){exportButton.innerHTML='Скачать демо · 6 сек <span aria-hidden="true">↓</span>';updateExport();}}
  exportButton.addEventListener('click',()=>{
    if(recording||!image)return;const mime=chosenMime();if(!mime)return;
    const chunks=[];let failed=false;const restorePause=paused;
    function cleanup(){clearTimeout(exportTimer);exportStream?.getTracks().forEach(t=>t.stop());exportStream=null;recorder=null;abortExport=null;paused=restorePause;syncPause();lock(false);}
    abortExport=()=>{failed=true;feedback.textContent='Запись прервана: вкладка была скрыта. Повторите в активной вкладке.';if(recorder?.state==='recording')recorder.stop();else cleanup();};
    try{
      elapsed=0;paused=false;draw(0);exportStream=canvas.captureStream(30);recorder=new MediaRecorder(exportStream,{mimeType:mime,videoBitsPerSecond:4000000});
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>{failed=true;feedback.textContent='Браузер не смог записать видео. Попробуйте другой браузер.';cleanup();};
      recorder.onstop=()=>{
        if(!failed&&chunks.length){const blob=new Blob(chunks,{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='side-a-'+mood+'-demo.'+(mime.includes('mp4')?'mp4':'webm');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);feedback.textContent='Демо готово. Скачивание запущено — файл без звука. Добавьте свой трек в редакторе.';}else if(!failed){feedback.textContent='Запись получилась пустой. Повторите в активной вкладке.';}cleanup();
      };
      recorder.start(250);lock(true);syncPause();exportButton.textContent='Записываем · 6 сек…';feedback.textContent='Оставьте вкладку открытой на 6 секунд. Видео записывается только на вашем устройстве.';
      exportTimer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},6000);
    }catch(error){failed=true;feedback.textContent='Запись недоступна. Откройте сайт по HTTP/HTTPS в актуальном Chrome или Edge.';cleanup();}
  });
  document.addEventListener('visibilitychange',()=>{previous=0;if(document.hidden&&recording)abortExport?.();});
  window.addEventListener('pagehide',()=>{if(sourceUrl)URL.revokeObjectURL(sourceUrl);clearTimeout(exportTimer);exportStream?.getTracks().forEach(t=>t.stop());});
  loadDefault();requestAnimationFrame(loop);
})();