import '@styles/tokens.css';
import '@styles/base.css';
import 'sonner-web-component';
import '@screens/PidiefApp/PidiefApp';
import { failWith } from '@util/Toast';

if (!document.querySelector('sonner-toaster')) {
  const toaster = document.createElement('sonner-toaster');
  toaster.setAttribute('position', 'bottom-right');
  toaster.setAttribute('rich-colors', '');
  document.body.appendChild(toaster);
}

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) failWith("L'application n'a pas pu se démarrer correctement");

host.innerHTML = '';
host.appendChild(document.createElement('pidief-app'));
