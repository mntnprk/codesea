(() => {
'use strict';
const status = document.querySelector('#server-status');
const cards = document.querySelector('#server-cards');
const mib = value => value == null ? '확인 불가' : (value / 1048576).toFixed(1) + ' MiB';
function render(data, rtt) {
  const groups = {
    '서버 시각 · 실행 환경': {'서버 UTC 시각':data.serverTime,'서버 시간대':data.timezone,'OS':data.platform + ' ' + data.release,'아키텍처':data.architecture,'Node.js':data.node,'프로세스 가동 시간':data.processUptimeSeconds + ' 초','호스트 가동 시간':data.hostUptimeSeconds + ' 초'},
    'CPU · 이벤트 루프': {'호스트 CPU 모델':data.cpuModel,'호스트 논리 CPU':data.hostLogicalCpus,'사용 가능 병렬도 (CPU 할당량과 다를 수 있음)':data.availableParallelism,'프로세스 CPU (1코어 = 100%)':data.processCpuPercentOneCore + '%','호스트 부하 (1·5·15분)':data.hostLoadAverage.join(' / '),'이벤트 루프 평균 지연':data.eventLoopDelayMeanMs + ' ms'},
    '메모리': {'호스트 전체':mib(data.hostMemoryTotal),'호스트 여유':mib(data.hostMemoryFree),'cgroup 사용':mib(data.cgroupMemoryCurrent),'cgroup 한도':mib(data.cgroupMemoryLimit),'프로세스 RSS':mib(data.processMemory.rss),'JS 힙 사용':mib(data.processMemory.heapUsed),'JS 힙 확보':mib(data.processMemory.heapTotal),'외부 메모리':mib(data.processMemory.external)},
    '요청 · 통신': {'전체 요청':data.requests,'정보 API 요청':data.apiRequests,'현재 처리 중 요청 (이 요청 포함)':data.activeRequests,'브라우저 측 왕복 시간':rtt.toFixed(1) + ' ms','조회 간격':'이전 요청 완료 후 1초'}
  };
  cards.replaceChildren();
  for (const [title, values] of Object.entries(groups)) {
    const section = document.createElement('section'), h = document.createElement('h2'), dl = document.createElement('dl');
    h.textContent = title; section.append(h);
    for (const [label,value] of Object.entries(values)) {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      row.className = 'row'; dt.textContent = label; dd.textContent = String(value); row.append(dt,dd); dl.append(row);
    }
    section.append(dl); cards.append(section);
  }
}
async function poll() {
  if (!document.hidden) {
    try {
      const started = performance.now();
      const response = await fetch('api/server-info', {cache:'no-store', signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json(); render(data,performance.now() - started);
      status.textContent = '연결됨 · 서버에서 받은 최신 정보';
    } catch {
      status.textContent = '연결 실패 · 표시된 값은 이전 측정값입니다. 이 화면은 Node 서버 배포 주소에서 열어야 합니다. GitHub Pages에서는 서버 API가 실행되지 않습니다.';
    }
  }
  setTimeout(poll,1000);
}
poll();

})();
