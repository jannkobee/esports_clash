const port = process.argv[2] ?? '9223';
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find(page => page.type === 'page');
if (!page) throw Error('No running live browser');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
socket.addEventListener('message', event => {
  const result = JSON.parse(event.data);
  if (result.id !== 1) return;
  console.log(JSON.stringify({ page: page.url, ...result.result?.result?.value, exception: result.result?.exceptionDetails }, null, 2));
  socket.close();
});
socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { returnByValue: true,
  expression: `({ text: document.body.innerText.slice(0, 500),
    errorOverlay: document.querySelector('vite-error-overlay')?.shadowRoot?.textContent?.slice(-1000),
    step: typeof window.__esportsPairedStep, restore: typeof window.__esportsPairedRestore,
    event: window.__esportsPairedMacro ? { second: window.__esportsPairedMacro.second, actorId: window.__esportsPairedMacro.actorId } : null,
    inspection: window.__esportsPairedInspect ? { second: window.__esportsPairedInspect().second } : null })` } }));
