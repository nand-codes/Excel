const status = document.getElementById('status');
const fallback = document.getElementById('fallback');
const link = document.getElementById('link');
const channelName = 'excel-wa-deliver';

function go(url) {
  link.href = url;
  window.location.replace(url);
}

if (typeof BroadcastChannel !== 'undefined') {
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event) => {
    if (event.data?.url) go(event.data.url);
  };
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.type !== 'excel-wa-deliver' || !data.url) return;
  go(data.url);
});

window.setTimeout(() => {
  status.textContent = 'Taking longer than expected…';
  fallback.hidden = false;
}, 8000);
