import '@styles/tokens.css';
import '@styles/base.css';
import '@screens/PidiefApp/PidiefApp';

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('[pidief] #app introuvable dans index.html');

host.innerHTML = '';
host.appendChild(document.createElement('pidief-app'));
