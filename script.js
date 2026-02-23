const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby-RuV2kNlb7Mp5sNF0IGCxPMBhz-4aAYO-D93DkPrwTslSsVaaVpdTqGA1NJlQ4u2xlA/exec';
const LINE_LINK = 'https://line.me/R/ti/p/@yourid';

// รายการของรางวัลและค่าน้ำหนัก (Weight) - ตัวเลขยิ่งเยอะ โอกาสออกยิ่งสูง
const prizes = [
    { label: "พัดลม", weight: 10 },
    { label: "ร่ม", weight: 5 },
    { label: "เครื่องคิดเลข", weight: 10 },
    { label: "โน๊ตก้อน", weight: 60 },
    { label: "แผ่นรองเม้าส์", weight: 2 },
    { label: "ของรางวัล Belden", weight: 18 }
];

let userData = {};
let currentRotation = 0;

// 1. ฟังก์ชันสุ่มของรางวัลแบบถ่วงน้ำหนัก
function getRandomPrize() {
    let totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    for (let prize of prizes) {
        if (random < prize.weight) return prize;
        random -= prize.weight;
    }
}

// 2. จัดการการลงทะเบียน
document.getElementById('reg-form').addEventListener('submit', function(e) {
    e.preventDefault(); // สำคัญมาก: ป้องกันหน้าจอรีเฟรชเอง
    
    // เก็บข้อมูลลงตัวแปร
    userData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        company: document.getElementById('company').value,
        position: document.getElementById('position').value
    };

    // เปลี่ยนหน้าทันที (ไม่ต้องรอส่งข้อมูลเสร็จ เพื่อความลื่นไหล)
    document.getElementById('form-section').classList.add('hidden');
    document.getElementById('game-section').classList.remove('hidden');
    
    // วาดวงล้อรอไว้
    drawWheel();
});

// 3. วาดวงล้อ (Canvas)
function drawWheel() {
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    const arc = (Math.PI * 2) / prizes.length;

    prizes.forEach((prize, i) => {
        const angle = i * arc;
        ctx.beginPath();
        ctx.fillStyle = i % 2 === 0 ? '#2e5a73' : '#1e3d4f';
        ctx.moveTo(200, 200);
        ctx.arc(200, 200, 180, angle, angle + arc);
        ctx.fill();
        
        ctx.save();
        ctx.translate(200, 200);
        ctx.rotate(angle + arc / 2);
        ctx.fillStyle = "white";
        ctx.fillText(prize.label, 100, 5);
        ctx.restore();
    });
}

// 4. การหมุนวงล้อและการส่งข้อมูล
document.getElementById('spin-btn').addEventListener('click', () => {
    const selectedPrize = getRandomPrize();
    userData.prize = selectedPrize.label;
    
    const prizeIndex = prizes.indexOf(selectedPrize);
    const extraSpins = 5 * 360; // หมุน 5 รอบก่อนหยุด
    const segmentAngle = 360 / prizes.length;
    const stopAngle = extraSpins + (360 - (prizeIndex * segmentAngle)) - (segmentAngle/2);

    const canvas = document.getElementById('wheelCanvas');
    canvas.style.transition = "transform 4s cubic-bezier(0.15, 0, 0.15, 1)";
    canvas.style.transform = `rotate(${stopAngle}deg)`;

    // เมื่อหมุนเสร็จ
    setTimeout(async () => {
        // ส่งข้อมูลไป Google Sheet
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(userData)
            });
        } catch (err) { console.error("Save error", err); }

        // แสดงผลลัพธ์
        document.getElementById('prize-display').innerText = userData.prize;
        document.getElementById('game-section').classList.add('hidden');
        document.getElementById('result-section').classList.remove('hidden');
    }, 4500);
});

// 5. ปุ่มเสร็จสิ้น
document.getElementById('finish-btn').addEventListener('click', () => {
    window.location.href = LINE_LINK;
});
