/* ============================================================
   i18n — Apex Vision (ES / EN)
   window.I18N.t('key') → string en el idioma actual.
   Cambiar idioma: window.I18N.set('en'|'es') → dispara 'apex:lang-change'.
   En React: const lang = useLang();  // re-renderiza al cambiar
   ============================================================ */
(function () {
  var DICT = {
    es: {
      'lang.name': 'Español',
      'lang.toggle': 'EN',
      // auth
      'auth.tagline': 'Evaluación comercial con IA',
      'auth.email': 'Email', 'auth.password': 'Contraseña',
      'auth.passwordMin': 'Contraseña (mín. 6 caracteres)', 'auth.confirm': 'Confirmá la contraseña',
      'auth.login': 'Ingresar', 'auth.connecting': 'Conectando…',
      'auth.noAccount': '¿No tenés cuenta?', 'auth.register': 'Registrate',
      'auth.haveAccount': '¿Ya tenés cuenta?', 'auth.signin': 'Iniciá sesión',
      'auth.createAccount': 'Crear cuenta', 'auth.creating': 'Creando cuenta…',
      'auth.err.badCreds': 'Email o contraseña incorrectos.',
      'auth.err.server': 'No se pudo conectar con el servidor. Verificá tu conexión.',
      'auth.err.mismatch': 'Las contraseñas no coinciden.',
      'auth.err.short': 'La contraseña debe tener al menos 6 caracteres.',
      'auth.err.exists': 'Ese email ya tiene una cuenta. Iniciá sesión.',
      'auth.err.create': 'No se pudo crear la cuenta. Verificá tu conexión.',
      'auth.expired': 'Tu sesión expiró. Volvé a iniciar sesión.',
      // nav
      'nav.dashboard': 'Dashboard', 'nav.evaluations': 'Evaluaciones', 'nav.progress': 'Progreso',
      'nav.coaching': 'Coaching IA', 'nav.plan': 'Mi Plan', 'nav.profile': 'Perfil', 'nav.settings': 'Configuración',
      'nav.logout': 'Salir',
      // entry tiles
      'entry.live.sales': 'Pitch en vivo', 'entry.live.interview': 'Simulá tu entrevista',
      'entry.live.salesDesc': 'Presentá tu pitch a un comprador con IA en tiempo real',
      'entry.live.interviewDesc': 'Practicá una entrevista laboral con un entrevistador IA',
      // live setup
      'live.beta': 'Agente en vivo · BETA',
      'live.back': '← Volver',
      'live.title.sales': 'Practicá con una persona real',
      'live.title.interview': 'Practicá tu entrevista',
      'live.subtitle.sales': 'El agente te escucha en tiempo real y responde en personaje. Elegí el escenario.',
      'live.subtitle.interview': 'Un entrevistador IA te escucha en tiempo real y repregunta. Elegí el escenario.',
      'live.section.mode': 'Tipo de práctica',
      'live.section.roleSales': '¿A quién le presentás?',
      'live.section.roleInterview': '¿Quién te entrevista?',
      'live.section.level': 'Nivel de dificultad',
      'live.section.lang': 'Idioma de la conversación',
      'live.section.scenarioSales': '¿Qué venís a presentar? (opcional)',
      'live.section.scenarioInterview': 'Puesto / tu CV (opcional)',
      'live.scenarioPh.sales': 'Ej: Plataforma SaaS de evaluación de ventas con IA',
      'live.scenarioPh.interview': 'Ej: Vacante de Account Executive. Vengo de 3 años en ventas B2B SaaS.',
      'live.start': 'Iniciar conversación',
      'mode.sales': 'Presentación de ventas', 'mode.salesDesc': 'Presentás tu pitch a un comprador',
      'mode.interview': 'Entrevista laboral', 'mode.interviewDesc': 'Te entrevistan para un puesto',
      // live room
      'live.end': 'Terminar',
      'live.state.connecting': 'Conectando…', 'live.state.listening': 'Te escucho',
      'live.state.thinking': 'Pensando…', 'live.state.speaking': 'Hablando',
      'live.hint': 'El agente abrirá la conversación. Respondé con naturalidad.',
      'live.ptt.hold': 'Mantené presionado para hablar', 'live.ptt.talking': 'Hablá… soltá para enviar',
      'live.handsfree': 'Manos libres · hablá cuando quieras, el agente detecta tus turnos',
      'live.err.mic': 'Necesito permiso de micrófono.',
      'live.err.connect': 'No se pudo conectar al agente.',
      'live.err.agent': 'El agente tuvo un problema. Reintentá.',
      'live.finish': 'Terminar y evaluar',
      'live.scoring': 'Evaluando tu sesión…',
      'live.results.title': 'Tu evaluación',
      'live.results.overall': 'Puntaje global',
      'live.results.strengths': 'Fortalezas',
      'live.results.improvements': 'A mejorar',
      'live.results.none': 'La conversación fue muy corta para evaluar. Probá de nuevo con un intercambio más largo.',
      'live.results.again': 'Practicar de nuevo',
      'live.results.close': 'Cerrar',
      // levels
      'level.accesible': 'Accesible', 'level.accesibleDesc': 'Cálido, pocas objeciones',
      'level.neutral': 'Neutral', 'level.neutralDesc': 'Profesional y equilibrado',
      'level.exigente': 'Exigente', 'level.exigenteDesc': 'Escéptico, objeta, interrumpe',
    },
    en: {
      'lang.name': 'English',
      'lang.toggle': 'ES',
      'auth.tagline': 'AI sales evaluation',
      'auth.email': 'Email', 'auth.password': 'Password',
      'auth.passwordMin': 'Password (min. 6 characters)', 'auth.confirm': 'Confirm password',
      'auth.login': 'Sign in', 'auth.connecting': 'Connecting…',
      'auth.noAccount': "Don't have an account?", 'auth.register': 'Sign up',
      'auth.haveAccount': 'Already have an account?', 'auth.signin': 'Sign in',
      'auth.createAccount': 'Create account', 'auth.creating': 'Creating account…',
      'auth.err.badCreds': 'Incorrect email or password.',
      'auth.err.server': 'Could not reach the server. Check your connection.',
      'auth.err.mismatch': 'Passwords do not match.',
      'auth.err.short': 'Password must be at least 6 characters.',
      'auth.err.exists': 'That email already has an account. Sign in.',
      'auth.err.create': 'Could not create the account. Check your connection.',
      'auth.expired': 'Your session expired. Please sign in again.',
      'nav.dashboard': 'Dashboard', 'nav.evaluations': 'Evaluations', 'nav.progress': 'Progress',
      'nav.coaching': 'AI Coaching', 'nav.plan': 'My Plan', 'nav.profile': 'Profile', 'nav.settings': 'Settings',
      'nav.logout': 'Log out',
      'entry.live.sales': 'Live pitch', 'entry.live.interview': 'Mock interview',
      'entry.live.salesDesc': 'Pitch to a real-time AI buyer',
      'entry.live.interviewDesc': 'Practice a job interview with an AI interviewer',
      'live.beta': 'Live agent · BETA',
      'live.back': '← Back',
      'live.title.sales': 'Practice with a real person',
      'live.title.interview': 'Practice your interview',
      'live.subtitle.sales': 'The agent listens in real time and responds in character. Pick your scenario.',
      'live.subtitle.interview': 'An AI interviewer listens in real time and follows up. Pick your scenario.',
      'live.section.mode': 'Practice type',
      'live.section.roleSales': 'Who are you pitching to?',
      'live.section.roleInterview': 'Who is interviewing you?',
      'live.section.level': 'Difficulty level',
      'live.section.lang': 'Conversation language',
      'live.section.scenarioSales': 'What are you presenting? (optional)',
      'live.section.scenarioInterview': 'Role / your résumé (optional)',
      'live.scenarioPh.sales': 'e.g. SaaS platform for AI sales evaluation',
      'live.scenarioPh.interview': 'e.g. Account Executive role. 3 years in B2B SaaS sales.',
      'live.start': 'Start conversation',
      'mode.sales': 'Sales pitch', 'mode.salesDesc': 'You pitch to a buyer',
      'mode.interview': 'Job interview', 'mode.interviewDesc': 'You get interviewed for a role',
      'live.end': 'End',
      'live.state.connecting': 'Connecting…', 'live.state.listening': 'Listening',
      'live.state.thinking': 'Thinking…', 'live.state.speaking': 'Speaking',
      'live.hint': 'The agent will open the conversation. Respond naturally.',
      'live.ptt.hold': 'Hold to talk', 'live.ptt.talking': 'Speak… release to send',
      'live.handsfree': 'Hands-free · just talk, the agent detects your turns',
      'live.err.mic': 'I need microphone permission.',
      'live.err.connect': 'Could not connect to the agent.',
      'live.err.agent': 'The agent had a problem. Try again.',
      'live.finish': 'End & evaluate',
      'live.scoring': 'Evaluating your session…',
      'live.results.title': 'Your evaluation',
      'live.results.overall': 'Overall score',
      'live.results.strengths': 'Strengths',
      'live.results.improvements': 'To improve',
      'live.results.none': 'The conversation was too short to evaluate. Try again with a longer exchange.',
      'live.results.again': 'Practice again',
      'live.results.close': 'Close',
      'level.accesible': 'Easygoing', 'level.accesibleDesc': 'Warm, few objections',
      'level.neutral': 'Neutral', 'level.neutralDesc': 'Professional and balanced',
      'level.exigente': 'Demanding', 'level.exigenteDesc': 'Skeptical, objects, interrupts',
    },
  };

  var current = localStorage.getItem('apex_lang') || 'es';
  if (current !== 'es' && current !== 'en') current = 'es';

  window.I18N = {
    get() { return current; },
    set(l) {
      if (l !== 'es' && l !== 'en') return;
      current = l;
      localStorage.setItem('apex_lang', l);
      window.dispatchEvent(new CustomEvent('apex:lang-change', { detail: l }));
    },
    toggle() { this.set(current === 'es' ? 'en' : 'es'); },
    t(key, lang) {
      var L = lang || current;
      return (DICT[L] && DICT[L][key]) || (DICT.es && DICT.es[key]) || key;
    },
  };

  // Inline translator: L('texto es', 'text en') → string in current language.
  // Lets us localize legacy screens with one edit per string, no key bookkeeping.
  window.L = function (es, en) { return current === 'en' ? en : es; };

  // React hook: re-render on language change.
  window.useLang = function useLang() {
    var _a = React.useState(current), lang = _a[0], setLang = _a[1];
    React.useEffect(function () {
      var on = function (e) { setLang(e.detail); };
      window.addEventListener('apex:lang-change', on);
      return function () { window.removeEventListener('apex:lang-change', on); };
    }, []);
    return lang;
  };
})();
