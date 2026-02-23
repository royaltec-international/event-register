const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby-RuV2kNlb7Mp5sNF0IGCxPMBhz-4aAYO-D93DkPrwTslSsVaaVpdTqGA1NJlQ4u2xlA/exec';
const LINE_LINK = 'https://line.me/R/ti/p/@yourid';

let userData = {};

// ตั้งค่าของรางวัลและค่าน้ำหนัก (Weight)
const prizeItems = [
    { label: "พัดลม", weight: 10, color: "#e74c3c" },
    { label: "เครื่องคิดเลข", weight: 10, color: "#2ecc71" },
    { label: "โน๊ตก้อน", weight: 60, color: "#ffffff" },
    { label: "แผ่นรองเม้าส์", weight: 2, color: "#9b59b6" },
    { label: "รางวัล Belden", weight: 18, color: "#3498db" }
];

// สุ่มแบบถ่วงน้ำหนัก
function getWeightedPrize() {
    let totalWeight = prizeItems.reduce((s, i) => s + i.weight, 0);
    let random = Math.random() * totalWeight;
    for (let item of prizeItems) {
        if (random < item.weight) return item;
        random -= item.weight;
    }
}

// วาดวงล้อ
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
function drawWheel() {
    const arc = (Math.PI * 2) / prizeItems.length;
    prizeItems.forEach((item, i) => {
        const angle = i * arc;
        ctx.beginPath();
        ctx.fillStyle = item.color;
        ctx.moveTo(220, 220);
        ctx.arc(220, 220, 220, angle, angle + arc);
        ctx.fill();
        ctx.save();
        ctx.translate(220, 220);
        ctx.rotate(angle + arc / 2);
        ctx.fillStyle = item.color === "#ffffff" ? "#333" : "#fff";
        ctx.font = "bold 16px Kanit";
        ctx.fillText(item.label, 100, 10);
        ctx.restore();
    });
}
drawWheel();

// จัดการการส่งฟอร์ม
document.getElementById('reg-form').onsubmit = (e) => {
    e.preventDefault();
    userData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        company: document.getElementById('company').value,
        position: document.getElementById('position').value
    };
    document.getElementById('form-section').classList.add('hidden');
    document.getElementById('game-section').classList.remove('hidden');
};

// หมุนวงล้อ
let spinning = false;
document.getElementById('spin-btn').onclick = () => {
    if (spinning) return;
    spinning = true;

    const prize = getWeightedPrize();
    const idx = prizeItems.indexOf(prize);
    const deg = 3600 + (360 - (idx * (360 / prizeItems.length))) - (180 / prizeItems.length);

    canvas.style.transform = `rotate(${deg}deg)`;

    setTimeout(async () => {
        userData.prize = prize.label;
        document.getElementById('prize-name').innerText = prize.label;
        
        // ส่งข้อมูลเข้า Google Sheet
        try {
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(userData) });
        } catch (e) {}

        document.getElementById('game-section').classList.add('hidden');
        document.getElementById('result-section').classList.remove('hidden');
    }, 5500);
};

document.getElementById('finish-btn').onclick = () => window.location.href = LINE_LINK;
