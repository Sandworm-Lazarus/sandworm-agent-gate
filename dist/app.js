(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const policy = $('policy'), calls = $('calls');
  let revision = 0, report = null;
  const thaiReasons = {
    ALLOW:'อ่านตาม tool, action, resource และงบที่อนุญาต', REVIEW_WRITE:'คำสั่งเขียนต้องรับการอนุมัติในระบบภายนอก', REVIEW_POLICY:'นโยบายกำหนดให้ตรวจอนุมัติภายนอก', DENY_TOOL:'tool ไม่อยู่ใน allowlist', DENY_EXPLICIT:'ตรงกับ deny rule ซึ่งมีผลเหนือ allow', DENY_ACTION:'action ไม่อยู่ในสิทธิ์ของ tool', DENY_RESOURCE:'resource อยู่นอกขอบเขตที่อนุญาต', DENY_PATH:'path ไม่เป็นรูปแบบ canonical ที่รองรับ', DENY_BUDGET:'ต้นทุนประมาณการเกินงบต่อ call', DENY_CALL:'โครงสร้างคำสั่งไม่ตรง schema', DENY_DUPLICATE:'ID ซ้ำภายใน batch — ปฏิเสธทุกคำสั่งที่ใช้ ID นี้'
  };
  function invalidate(message) { revision++; report = null; $('results').hidden = true; $('empty').hidden = false; $('export').disabled = true; $('error').hidden = true; $('status').textContent = message || 'ข้อมูลเปลี่ยนแล้ว กรุณาตรวจนโยบายอีกครั้ง'; }
  function showError() { $('error').textContent = 'ตรวจข้อมูลไม่ได้: ต้องเป็น JSON ตาม schema, ไม่ใช้ key ซ้ำ และไม่เกินขอบเขตที่กำหนด'; $('error').hidden = false; $('status').textContent = 'ไม่มี audit ให้ส่งออก'; }
  function sample() { policy.value = JSON.stringify(AgentGate.samplePolicy, null, 2); calls.value = JSON.stringify(AgentGate.sampleCalls, null, 2); invalidate('โหลดตัวอย่างสมมติ 6 กรณีแล้ว กดตรวจนโยบาย'); }
  function line(tag, text, cls) { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; }
  function render(result) {
    $('allow-count').textContent = result.counts.allow; $('review-count').textContent = result.counts.review; $('deny-count').textContent = result.counts.deny;
    $('timeline').replaceChildren();
    for (const row of result.rows) {
      const card = document.createElement('article'); card.className = 'result-card ' + (row.decision === 'allow' ? 'pass' : row.decision === 'deny' ? 'fail' : 'review');
      const heading = document.createElement('div'); heading.className = 'decision-heading'; heading.append(line('strong', 'คำสั่ง ' + String(row.sequence).padStart(2,'0') + (row.toolSlot ? ' / TOOL #' + row.toolSlot : ' / UNMATCHED')), line('span', row.decision.toUpperCase(), 'badge'));
      card.append(heading, line('p', thaiReasons[row.reason], 'hint'), line('p', row.reason + ' · ' + row.callSha256.slice(0,16) + '…', 'digest')); $('timeline').append(card);
    }
    $('provenance').textContent = JSON.stringify({engineVersion:result.engineVersion,mode:result.mode,policySha256:result.policySha256,inputSha256:result.inputSha256},null,2);
    $('results').hidden = false; $('empty').hidden = true; $('export').disabled = false; $('status').textContent = 'ตรวจครบ ' + result.counts.total + ' คำสั่ง · เป็นการจำลอง ไม่มีการเรียกใช้เครื่องมือ';
  }
  policy.addEventListener('input', () => invalidate()); calls.addEventListener('input', () => invalidate());
  $('sample').addEventListener('click', sample);
  $('clear').addEventListener('click', () => { policy.value = ''; calls.value = ''; $('policy-file').value = ''; $('calls-file').value = ''; invalidate('ล้างข้อมูลในหน้านี้แล้ว'); });
  $('audit').addEventListener('click', async () => {
    invalidate('กำลังตรวจนโยบาย…'); const current = revision;
    try { const result = await AgentGate.audit(policy.value,calls.value); if (revision !== current) return; report = result; render(result); }
    catch (_) { if (revision === current) showError(); }
  });
  for (const [fileId, target] of [['policy-file',policy],['calls-file',calls]]) $(fileId).addEventListener('change', async event => {
    invalidate('กำลังอ่านไฟล์…'); const current = revision; const file = event.target.files && event.target.files[0];
    if (!file) { $('status').textContent='ยกเลิกการเลือกไฟล์'; return; }
    try {
      if (file.size > AgentGate.limits.maxBytes || !/\.json$/i.test(file.name)) throw Error();
      const content = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      if (revision !== current) return; AgentGate.parse(content); target.value = content; $('status').textContent='นำเข้า JSON แล้ว กดตรวจนโยบาย';
    } catch (_) { if (revision === current) showError(); }
    event.target.value = '';
  });
  $('export').addEventListener('click', () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sandworm-agent-gate-audit.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000); $('status').textContent='ส่งออก audit โดยไม่ใส่ arguments, ชื่อ tool, path หรือ ID ต้นฉบับแล้ว';
  });
})();
