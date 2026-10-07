import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/src/css/index.sass';
import './css/app.scss';
import './css/fluent.scss';

import { Quasar } from 'quasar';
import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router';

createApp(App).use(Quasar, {}).use(router).mount('#app');
