// ============================================================
//  script.js
//  ควบคุมการทำงานหลัก: Form, Wheel, Result, Google Sheets
//  ทุก config อยู่ใน wheelConfig.js — ไม่ต้องแก้ไฟล์นี้บ่อย
// ============================================================

(() => {
  'use strict';

  // ----------------------------------------------------------
  //  State
  // ----------------------------------------------------------
  const state = {
    currentPage: 'form',      // 'form' | 'wheel' | 'result'
    userData: null,
    prizesRemaining: {},      // { prizeId: remainingCount }
    currentAngle: 0,          // มุมปัจจุบันของวงล้อ (radians)
    isSpinning: false,
    wonPrize: null,
  };

  // ----------------------------------------------------------
  //  DOM refs
  // ----------------------------------------------------------
  const dom = {
    formSection:   document.getElementById('form-section'),
    wheelSection:  document.getElementById('wheel-section'),
    resultSection: document.getElementById('result-section'),
    form:          document.getElementById('registration-form'),
    submitBtn:     document.getElementById('submit-btn'),
    spinBtn:       document.getElementById('spin-btn'),
    doneBtn:       document.getElementById('done-btn'),
    canvas:        document.getElementById('wheelCanvas'),
    pointer:       document.getElementById('wheel-pointer'),
    resultIcon:    document.getElementById('result-icon'),
    resultName:    document.getElementById('result-prize-name'),
    toast:         document.getElementById('toast'),
    confetti:      document.getElementById('confetti-canvas'),
    logoImg:       document.getElementById('logo-img'),
  };

  // ----------------------------------------------------------
  //  Init
  // ----------------------------------------------------------
  function init() {
    // ตั้งค่า Logo
    const logoWrapper = document.querySelector('.logo-wrapper');
    const logoImg = dom.logoImg;
    const fallback = document.getElementById('logo-fallback');

    const hasLogo = WHEEL_CONFIG.logoUrl &&
                    WHEEL_CONFIG.logoUrl !== '' &&
                    !WHEEL_CONFIG.logoUrl.includes('via.placeholder.com') &&
                    !WHEEL_CONFIG.logoUrl.includes('YOUR_');

    if (hasLogo) {
      logoImg.alt = WHEEL_CONFIG.logoAlt;
      logoImg.style.display = 'block';
      if (fallback) fallback.style.display = 'none';

      logoImg.onerror = function() {
        logoImg.style.display = 'none';
        if (fallback) fallback.style.display = 'flex';
      };
      logoImg.src = WHEEL_CONFIG.logoUrl;
    } else {
      logoImg.style.display = 'none';
      if (fallback) fallback.style.display = 'none'; // ซ่อนทั้งคู่ถ้ายังไม่ตั้งค่า
    }

    // ตั้งค่าจำนวนของรางวัลคงเหลือ
    WHEEL_CONFIG.prizes.forEach(p => {
      state.prizesRemaining[p.id] = p.quantity;
    });

    // วาดวงล้อครั้งแรก
    drawWheel(state.currentAngle);

    // ผูก Events
    dom.form.addEventListener('submit', handleFormSubmit);
    dom.spinBtn.addEventListener('click', handleSpin);
    dom.doneBtn.addEventListener('click', handleDone);
  }

  // ----------------------------------------------------------
  //  Page Navigation
  // ----------------------------------------------------------
  function showPage(page) {
    const pages = { form: dom.formSection, wheel: dom.wheelSection, result: dom.resultSection };
    Object.values(pages).forEach(el => el.classList.remove('active'));
    pages[page].classList.add('active');
    state.currentPage = page;
  }

  // ----------------------------------------------------------
  //  Form Validation
  // ----------------------------------------------------------
  const validators = {
    firstName:  v => v.trim().length >= 2,
    lastName:   v => v.trim().length >= 2,
    email:      v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    phone:      v => /^[0-9]{9,10}$/.test(v.replace(/[-\s]/g, '')),
    company:    v => v.trim().length >= 2,
    position:   v => v.trim().length >= 2,
  };

  const errorMessages = {
    firstName:  'กรุณากรอกชื่อ (อย่างน้อย 2 ตัวอักษร)',
    lastName:   'กรุณากรอกนามสกุล (อย่างน้อย 2 ตัวอักษร)',
    email:      'รูปแบบอีเมลไม่ถูกต้อง',
    phone:      'กรุณากรอกเบอร์โทร 9-10 หลัก',
    company:    'กรุณากรอกชื่อบริษัท',
    position:   'กรุณากรอกตำแหน่งงาน',
  };

  function validateField(name, value) {
    return validators[name] ? validators[name](value) : true;
  }

  function showFieldError(name, show) {
    const errEl = document.getElementById(`error-${name}`);
    if (!errEl) return;
    errEl.textContent = show ? errorMessages[name] : '';
    errEl.classList.toggle('visible', show);
    const input = document.getElementById(`field-${name}`);
    if (input) input.classList.toggle('error', show);
  }

  function validateAll() {
    const data = getFormData();
    let valid = true;
    Object.keys(validators).forEach(name => {
      const ok = validateField(name, data[name] || '');
      showFieldError(name, !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  function getFormData() {
    return {
      firstName: document.getElementById('field-firstName').value,
      lastName:  document.getElementById('field-lastName').value,
      email:     document.getElementById('field-email').value,
      phone:     document.getElementById('field-phone').value,
      company:   document.getElementById('field-company').value,
      position:  document.getElementById('field-position').value,
    };
  }

  // Live validation on blur
  document.addEventListener('DOMContentLoaded', () => {
    Object.keys(validators).forEach(name => {
      const input = document.getElementById(`field-${name}`);
      if (!input) return;
      input.addEventListener('blur', () => {
        showFieldError(name, !validateField(name, input.value));
      });
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) {
          showFieldError(name, !validateField(name, input.value));
        }
      });
    });
  });

  // ----------------------------------------------------------
  //  Form Submit
  // ----------------------------------------------------------
  function handleFormSubmit(e) {
    e.preventDefault();
    if (!validateAll()) return;

    // เก็บข้อมูลไว้ใน state — ส่ง Sheets ครั้งเดียวหลังหมุนได้รางวัลแล้ว
    state.userData = getFormData();
    showPage('wheel');
  }

  // ----------------------------------------------------------
  //  Google Sheets (Apps Script)
  //  ใช้ URLSearchParams แทน FormData — เสถียรกว่ากับ Apps Script
  // ----------------------------------------------------------
  async function sendToGoogleSheets(payload) {
    if (!WHEEL_CONFIG.googleScriptUrl || WHEEL_CONFIG.googleScriptUrl.includes('YOUR_SCRIPT_ID')) {
      console.warn('Google Script URL ยังไม่ได้ตั้งค่า — ข้ามการส่งข้อมูล');
      return;
    }

    const params = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => params.append(k, v));

    await fetch(WHEEL_CONFIG.googleScriptUrl, {
      method: 'POST',
      body: params.toString(),
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  // ----------------------------------------------------------
  //  Wheel Drawing
  // ----------------------------------------------------------
  function getActiveSegments() {
    // กรอง prize ที่ยังมีเหลืออยู่
    return WHEEL_CONFIG.prizes.filter(p => state.prizesRemaining[p.id] > 0);
  }

  function drawWheel(rotationAngle) {
    const canvas = dom.canvas;
    const ctx = canvas.getContext('2d');
    const segments = getActiveSegments();
    const total = segments.length;

    if (total === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r  = cx - 4;
    const arc = (2 * Math.PI) / total;
    const cfg = WHEEL_CONFIG.wheel;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    segments.forEach((seg, i) => {
      const startAngle = rotationAngle + i * arc;
      const endAngle   = startAngle + arc;
      const midAngle   = startAngle + arc / 2;

      // Slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      const textR = r * 0.64;
      ctx.textAlign = 'right';
      ctx.fillStyle = seg.textColor || '#ffffff';
      ctx.font = `600 ${cfg.fontSize}px ${cfg.fontFamily}`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;

      // Icon
      const iconFont = `${cfg.fontSize + 2}px serif`;
      ctx.font = iconFont;
      ctx.fillText(seg.icon, textR + 4, 4);

      // Label (wrap ถ้ายาว)
      ctx.font = `600 ${cfg.fontSize}px ${cfg.fontFamily}`;
      const maxW = textR - 24;
      wrapText(ctx, seg.label, textR - 22, 0, maxW, cfg.fontSize * 1.3);

      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = WHEEL_CONFIG.wheel.centerCircleColor;
    ctx.fill();
    ctx.strokeStyle = WHEEL_CONFIG.wheel.centerCircleBorderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center icon
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    // Simple word-wrap for Thai (split by char if too wide)
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y + lineHeight / 4);
      return;
    }
    // Split mid-point
    const half = Math.ceil(text.length / 2);
    const line1 = text.slice(0, half);
    const line2 = text.slice(half);
    ctx.fillText(line1, x, y - lineHeight / 2 + lineHeight / 4);
    ctx.fillText(line2, x, y + lineHeight / 2 + lineHeight / 4);
  }

  // ----------------------------------------------------------
  //  Prize Selection (Weighted Random)
  // ----------------------------------------------------------
  function pickPrize() {
    const active = getActiveSegments();
    if (active.length === 0) return null;

    const totalWeight = active.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const prize of active) {
      rand -= prize.weight;
      if (rand <= 0) return prize;
    }
    return active[active.length - 1];
  }

  // ----------------------------------------------------------
  //  Spin
  // ----------------------------------------------------------
  function handleSpin() {
    if (state.isSpinning) return;

    const active = getActiveSegments();
    if (active.length === 0) {
      showToast('ของรางวัลหมดแล้ว!', 'error');
      return;
    }

    const prize = pickPrize();
    state.wonPrize = prize;
    state.isSpinning = true;
    dom.spinBtn.disabled = true;
    dom.canvas.classList.add('spinning');

    // คำนวณมุมปลายทาง
    const segments = getActiveSegments();
    const segCount = segments.length;
    const prizeIndex = segments.findIndex(s => s.id === prize.id);
    const arc = (2 * Math.PI) / segCount;

    // Pointer อยู่ด้านบน (−π/2) → คำนวณให้ segment นั้นหยุดที่ pointer
    const cfg = WHEEL_CONFIG.spin;
    const rotations = cfg.minRotations + Math.random() * (cfg.maxRotations - cfg.minRotations);
    const targetAngle =
      -(prizeIndex * arc + arc / 2) - (Math.PI / 2) + (2 * Math.PI * rotations);

    spinAnimate(state.currentAngle, targetAngle, cfg.durationMs, () => {
      state.currentAngle = targetAngle % (2 * Math.PI);
      state.isSpinning = false;
      dom.canvas.classList.remove('spinning');

      // ลดจำนวนของรางวัล
      state.prizesRemaining[prize.id]--;

      // บันทึกข้อมูลรางวัลลง Google Sheets
      sendToGoogleSheets({
        ...state.userData,
        prize: prize.label,
        timestamp: new Date().toISOString()
      }).catch(console.error);

      // แสดงผลลัพธ์
      showResult(prize);
    });
  }

  function spinAnimate(from, to, duration, onDone) {
    const start = performance.now();
    const diff  = to - from;

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const angle = from + diff * eased;

      drawWheel(angle);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        drawWheel(to);
        onDone();
      }
    }

    requestAnimationFrame(frame);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ----------------------------------------------------------
  //  Result
  // ----------------------------------------------------------
  function showResult(prize) {
    dom.resultIcon.textContent = prize.icon;
    dom.resultName.textContent = prize.label;
    showPage('result');
    launchConfetti();
  }

  // ----------------------------------------------------------
  //  Done Button
  // ----------------------------------------------------------
  function handleDone() {
    window.open(WHEEL_CONFIG.lineAddFriendUrl, '_blank');
  }

  // ----------------------------------------------------------
  //  Confetti
  // ----------------------------------------------------------
  function launchConfetti() {
    const canvas = dom.confetti;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ffd700','#4cc9f0','#f94144','#43aa8b','#9b5de5','#ffffff'];
    const pieces = Array.from({ length: 120 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * -canvas.height,
      w:  6 + Math.random() * 8,
      h:  10 + Math.random() * 12,
      r:  Math.random() * Math.PI * 2,
      dr: (Math.random() - 0.5) * 0.2,
      dx: (Math.random() - 0.5) * 2,
      dy: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 0.8 + Math.random() * 0.2,
    }));

    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x  += p.dx;
        p.y  += p.dy;
        p.r  += p.dr;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (frame < 180) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(draw);
  }

  // ----------------------------------------------------------
  //  Toast
  // ----------------------------------------------------------
  function showToast(msg, type = 'info') {
    dom.toast.textContent = msg;
    dom.toast.className = `toast ${type} show`;
    setTimeout(() => { dom.toast.classList.remove('show'); }, 3000);
  }

  // ----------------------------------------------------------
  //  Start
  // ----------------------------------------------------------
  window.addEventListener('DOMContentLoaded', init);

})();
