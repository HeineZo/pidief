import '@styles/tokens.css';
import '@styles/base.css';
import 'sonner-web-component';
import { getPreferredLang, setLang, t } from '@i18n';
import '@screens/PidiefApp/PidiefApp';
import { failWith } from '@util/Toast';

setLang(getPreferredLang());

if (!document.querySelector('sonner-toaster')) {
  const toaster = document.createElement('sonner-toaster');
  toaster.setAttribute('position', 'bottom-right');
  toaster.setAttribute('rich-colors', '');
  document.body.appendChild(toaster);
}

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) failWith(t('app.bootFailed'));

host.innerHTML = '';
host.appendChild(document.createElement('pidief-app'));
