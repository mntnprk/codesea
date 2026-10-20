'use strict';
const cards = document.querySelector('#cards');
const status = document.querySelector('#status');
let report = {};
let generation = 0;
const unknown = '확인 불가';
function show(groups) {
  cards.replaceChildren();
  for (const [title, values] of Object.entries(groups)) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = title;
    section.append(heading);
    const dl = document.createElement('dl');
    for (const [label, value] of Object.entries(values)) {
      const row = document.createElement('div');
      row.className = 'row';
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value === undefined || value === null || value === '' ? unknown : String(value);
      row.append(dt, dd); dl.append(row);
    }
    section.append(dl); cards.append(section);
  }
}
async function collect() {
  const current = ++generation;
  status.textContent = '정보 확인 중…';
  const n = navigator;
  const connection = n.connection || n.mozConnection || n.webkitConnection;
  const groups = {
    '시스템 · 브라우저': {
      '운영체제 / 플랫폼 (브라우저 보고값)': n.userAgentData?.platform || n.platform,
      '브라우저 식별 문자열': n.userAgent,
      '언어': n.languages?.join(', ') || n.language,
      '시간대': Intl.DateTimeFormat().resolvedOptions().timeZone,
      '논리 프로세서 수 (브라우저 노출값)': n.hardwareConcurrency,
      '장치 메모리 (근삿값·상한 적용)': n.deviceMemory ? n.deviceMemory + ' GiB' : unknown,
      '최대 터치 접점': n.maxTouchPoints,
      '쿠키 사용 허용': n.cookieEnabled ? '예' : '아니요'
    },
    '화면': {
      '화면 크기 (CSS 픽셀)': screen.width + ' × ' + screen.height,
      '사용 가능 영역 (CSS 픽셀)': screen.availWidth + ' × ' + screen.availHeight,
      '브라우저 표시 영역': innerWidth + ' × ' + innerHeight,
      '픽셀 배율': devicePixelRatio,
      '색상 깊이': screen.colorDepth + ' bit',
      '화면 방향': screen.orientation?.type,
      '선호 테마': matchMedia('(prefers-color-scheme: dark)').matches ? '어두움' : '밝음'
    },
    '그래픽': {},
    '연결 · 실행 환경': {
      '브라우저 온라인 상태 (인터넷 연결 보장 아님)': n.onLine ? '온라인' : '오프라인',
      '연결 품질 추정': connection?.effectiveType,
      '다운링크 추정': connection?.downlink === undefined ? unknown : connection.downlink + ' Mbps',
      '왕복 지연 추정': connection?.rtt === undefined ? unknown : connection.rtt + ' ms',
      '데이터 절약 모드': connection ? (connection.saveData ? '켜짐' : '꺼짐') : unknown,
      '보안 컨텍스트': isSecureContext ? '예' : '아니요',
      '페이지 주소': location.origin + location.pathname
    }
  };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      groups['그래픽'] = {
        'GPU 제조사 (브라우저 보고값)': ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        'GPU 렌더러 (제한·대체될 수 있음)': ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        'WebGL 버전': gl.getParameter(gl.VERSION),
        '최대 텍스처 크기': gl.getParameter(gl.MAX_TEXTURE_SIZE)
      };
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } else groups['그래픽'] = {'WebGL': unknown};
  } catch { groups['그래픽'] = {'WebGL': unknown}; }
  show(groups);
  try {
    if (n.userAgentData?.getHighEntropyValues) {
      const data = await n.userAgentData.getHighEntropyValues(['architecture','bitness','platformVersion','fullVersionList']);
      Object.assign(groups['시스템 · 브라우저'], {
        '아키텍처 (브라우저 보고값)': data.architecture,
        '비트 수 (브라우저 보고값)': data.bitness,
        '플랫폼 버전 (제품명과 다를 수 있음)': data.platformVersion,
        '브라우저 버전': data.fullVersionList?.map(x => x.brand + ' ' + x.version).join(', ')
      });
    }
  } catch {}
  if (current !== generation) return;
  report = {checkedAt: new Date().toISOString(), groups};
  show(groups);
  status.textContent = '확인 완료 · ' + new Date().toLocaleString('ko-KR');
}
document.querySelector('#refresh').addEventListener('click', collect);
document.querySelector('#download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'pc-info.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
collect();

function startWorkerClock() {
  const panel = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Web Worker 타이머 · 100 ms';
  const clock = document.createElement('p');
  const timing = document.createElement('p');
  const note = document.createElement('p');
  note.textContent = '접속한 PC의 현지 시간입니다. 백그라운드 탭이나 절전 상태에서는 갱신이 지연될 수 있습니다.';
  panel.append(heading, clock, timing, note);
  document.querySelector('header').after(panel);
  if (!window.Worker) {
    clock.textContent = '이 브라우저는 Web Worker를 지원하지 않습니다.';
    return;
  }
  const workerSource = `
    let count = 0;
    setInterval(() => {
      self.postMessage({ count: ++count, sentAt: Date.now() });
    }, 100);
  `;
  const workerURL = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  let worker;
  let previous = null;
  let received = 0;
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  try {
    worker = new Worker(workerURL);
    // Worker는 신호를 보내고, 메인 스레드의 message handler에서 시간을 표시합니다.
    worker.onmessage = (event) => {
      URL.revokeObjectURL(workerURL);
      const now = new Date();
      const arrived = performance.now();
      const interval = previous === null ? '—' : (arrived - previous).toFixed(1) + ' ms';
      previous = arrived;
      received += 1;
      clock.textContent = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
        + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
        + '.' + pad(now.getMilliseconds(), 3);
      timing.textContent = '핸들러 수신: ' + received + '회 · 실제 수신 간격: ' + interval
        + ' · 설정 주기: 100 ms';
    };
    worker.onerror = () => {
      URL.revokeObjectURL(workerURL);
      worker.terminate();
      clock.textContent = 'Web Worker 타이머를 시작할 수 없습니다. 브라우저 설정을 확인하세요.';
    };
    window.addEventListener('pagehide', () => {
      worker.terminate();
      URL.revokeObjectURL(workerURL);
    }, { once: true });
    // 뒤로 가기 캐시에서 복원되면 종료된 Worker 대신 새로 시작합니다.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) { panel.remove(); startWorkerClock(); }
    }, { once: true });
  } catch {
    URL.revokeObjectURL(workerURL);
    clock.textContent = 'Web Worker 타이머를 시작할 수 없습니다.';
  }
}
startWorkerClock();
