// ============================================================
// PLANTILLAS PREMIUM — MyMediaConnect Artwork Proofing Platform
// 5 templates × 3 idiomas (ES / EN / FR)
// Basadas en el posicionamiento oficial: métricas reales, ICP,
// módulos, decisores y reglas de CTA de MyMediaConnect.
// ============================================================

const APP_URL = 'https://media-connector-lead-engine.vercel.app'

const MMC_LOGO = `<table cellpadding="0" cellspacing="0" border="0"><tr><td>
  <img src="${APP_URL}/logo.png" alt="MyMediaConnect" width="160" height="auto"
    style="display:block;border:0;outline:none;max-width:160px" />
</td></tr></table>`

export type Lang = 'es' | 'en' | 'fr'

// ─────────────────────────────────────────────────────────────
// I18N — textos por idioma, agrupados por template
// ─────────────────────────────────────────────────────────────

const T = {
  // Footer / unsubscribe common
  footer: {
    es: (unsub: string) => `Has recibido este email porque tenemos una relación comercial.<br><a href="${unsub}">Darse de baja</a> &nbsp;·&nbsp; mymediaconnect.com`,
    en: (unsub: string) => `You received this email because we have a business relationship.<br><a href="${unsub}">Unsubscribe</a> &nbsp;·&nbsp; mymediaconnect.com`,
    fr: (unsub: string) => `Vous avez reçu cet email car nous avons une relation commerciale.<br><a href="${unsub}">Se désabonner</a> &nbsp;·&nbsp; mymediaconnect.com`,
  },

  // ── TEMPLATE 1: LOOP (Pain point — ciclos de aprobación de packaging)
  loop: {
    es: {
      badge: 'Artwork Proofing',
      headline: '¿Cuántas versiones del mismo<br>packaging lleváis ya?',
      subline: 'Versión 14 del mismo arte. Aprobación pendiente desde hace 4 días. Producción esperando. El ciclo vuelve a empezar.',
      greeting: 'Hola {{nombre}},',
      intro: 'Si gestionas lanzamientos de packaging o artwork, seguramente reconoces este ciclo:',
      steps: [
        'El equipo de diseño prepara el arte final y lo envía por email.',
        'Marketing, Calidad y Regulatory reciben versiones distintas. Nadie sabe cuál es la buena.',
        'Los comentarios llegan dispersos: email, WhatsApp, reunión, llamada.',
        'Corriges. Subes la v14. Producción imprime la v12 por error. Nueva tirada.',
      ],
      midtext: 'El problema no es tu equipo. Es que el proceso de aprobación de packaging <strong style="color:#e2e8f0">no fue diseñado para la velocidad que exige el mercado actual.</strong>',
      with_mmc: 'Con MyMediaConnect',
      benefits: [
        'Un solo espacio para artwork, versiones, comentarios y aprobaciones',
        '−85% iteraciones en el proceso de revisión',
        'Audit trail completo — quién aprobó qué y cuándo',
        'Pantone/CMYK, códigos de barras, dielines y braille verificados en plataforma',
      ],
      cta: '¿Tienes 20 min esta semana? →',
      cta_note: 'Demo personalizada para tu sector · Sin compromiso',
    },
    en: {
      badge: 'Artwork Proofing',
      headline: 'How many versions of the same<br>packaging do you already have?',
      subline: 'Version 14 of the same artwork. Approval pending for 4 days. Production waiting. The cycle starts again.',
      greeting: 'Hi {{nombre}},',
      intro: 'If you manage packaging launches or artwork, you probably recognize this cycle:',
      steps: [
        'The design team prepares the final artwork and sends it by email.',
        'Marketing, Quality and Regulatory each receive different versions. Nobody knows which is correct.',
        'Comments arrive scattered: email, WhatsApp, meetings, calls.',
        'You fix it. Upload v14. Production prints v12 by mistake. New print run.',
      ],
      midtext: "The problem isn't your team. It's that your packaging approval process <strong style='color:#e2e8f0'>wasn't built for the speed today's market demands.</strong>",
      with_mmc: 'With MyMediaConnect',
      benefits: [
        'One single space for artwork, versions, comments and approvals',
        '−85% fewer review iterations',
        'Full audit trail — who approved what and when',
        'Pantone/CMYK, barcodes, dielines and braille verified in-platform',
      ],
      cta: 'Got 20 min this week? →',
      cta_note: 'Personalised demo for your sector · No commitment',
    },
    fr: {
      badge: 'Artwork Proofing',
      headline: 'Combien de versions du même<br>packaging avez-vous déjà ?',
      subline: 'Version 14 du même artwork. Validation en attente depuis 4 jours. Production bloquée. Et le cycle recommence.',
      greeting: 'Bonjour {{nombre}},',
      intro: 'Si vous gérez des lancements de packaging ou d\'artwork, ce cycle vous est probablement familier :',
      steps: [
        "L'équipe design prépare l'artwork final et l'envoie par email.",
        "Marketing, Qualité et Réglementaire reçoivent des versions différentes. Personne ne sait laquelle est la bonne.",
        "Les commentaires arrivent de partout : email, WhatsApp, réunion, téléphone.",
        "Vous corrigez. Uploadez la v14. Production imprime la v12 par erreur. Nouvelle impression.",
      ],
      midtext: "Le problème n'est pas votre équipe. C'est que votre processus de validation packaging <strong style='color:#e2e8f0'>n'a pas été conçu pour la vitesse qu'exige le marché actuel.</strong>",
      with_mmc: 'Avec MyMediaConnect',
      benefits: [
        'Un seul espace pour les artworks, versions, commentaires et validations',
        '−85% d\'itérations dans le processus de révision',
        'Audit trail complet — qui a validé quoi et quand',
        'Pantone/CMYK, codes-barres, dielines et braille vérifiés en plateforme',
      ],
      cta: 'Disponible 20 min cette semaine ? →',
      cta_note: 'Démo personnalisée pour votre secteur · Sans engagement',
    },
  },

  // ── TEMPLATE 2: ROI (Coste oculto — métricas reales)
  roi: {
    es: {
      badge: 'ROI Calculado',
      headline: 'Tu empresa pierde tiempo y dinero<br>aprobando packaging',
      subline: 'No en la imprenta. No en el diseño. En el proceso. Y probablemente no lo has medido hasta hoy.',
      greeting: 'Hola {{nombre}},',
      intro: 'Hemos analizado datos de empresas con más de 100 SKUs activos en FMCG, Pharma, Cosmética y Retail. Los números son contundentes:',
      metrics: [
        { num: '−45%', label: 'time-to-market', sub: 'en lanzamientos de packaging' },
        { num: '−85%', label: 'iteraciones', sub: 'en el proceso de aprobación' },
        { num: '−75%', label: 'errores', sub: 'en artes finales a producción' },
        { num: '−50%', label: 'costes', sub: 'de gestión del proceso' },
      ],
      mid1: 'Cada día que un packaging espera aprobación es un día que no está en el lineal. Ventanas de mercado perdidas, campañas desincronizadas, tiradas repetidas por errores detectados tarde.',
      mid2: 'El problema raíz es siempre el mismo: <strong style="color:#1e293b">marketing, diseño, calidad y regulatory trabajan sobre archivos distintos.</strong> Nadie tiene la versión definitiva hasta que ya es tarde para cambiarla.',
      features: [
        { icon: '🗂️', title: 'Un repositorio único de artworks', desc: 'Control de versiones automático. Fin de los "archivo_final_v14_OK.pdf". Permisos por rol, filtros por marca y mercado.' },
        { icon: '✅', title: 'Workflows de aprobación configurables', desc: 'Flujos secuenciales o paralelos. Deadlines automáticos. Recordatorios. Aprobación digital con audit trail completo.' },
        { icon: '🔍', title: 'Verificación técnica en plataforma', desc: 'Pantone/CMYK, códigos de barras, QR, braille y dielines. Catch errores antes de que lleguen a producción.' },
        { icon: '📊', title: 'Dashboards de KPIs ejecutivos', desc: 'Proyectos en riesgo, cuellos de botella, tiempo por fase. Visibilidad que el C-Level nunca ha tenido.' },
      ],
      cta_title: '¿Cuánto os está costando a vosotros?',
      cta_sub: 'Lo calculamos juntos en 20 minutos — directo a los números que importan a tu sector',
      cta: 'Reservar análisis gratuito →',
    },
    en: {
      badge: 'Calculated ROI',
      headline: 'Your company is losing time and money<br>approving packaging',
      subline: "Not at the printer. Not in design. In the process. And you probably haven't measured it until today.",
      greeting: 'Hi {{nombre}},',
      intro: 'We\'ve analysed data from companies with over 100 active SKUs in FMCG, Pharma, Cosmetics and Retail. The numbers are striking:',
      metrics: [
        { num: '−45%', label: 'time-to-market', sub: 'on packaging launches' },
        { num: '−85%', label: 'iterations', sub: 'in the approval process' },
        { num: '−75%', label: 'errors', sub: 'in final artwork to production' },
        { num: '−50%', label: 'costs', sub: 'of process management' },
      ],
      mid1: 'Every day a packaging waits for approval is a day it\'s not on the shelf. Lost market windows, out-of-sync campaigns, repeated print runs due to late-detected errors.',
      mid2: 'The root problem is always the same: <strong style="color:#1e293b">marketing, design, quality and regulatory are working from different files.</strong> Nobody has the definitive version until it\'s too late to change it.',
      features: [
        { icon: '🗂️', title: 'A single artwork repository', desc: 'Automatic version control. End of "final_artwork_v14_OK.pdf". Role-based permissions, filters by brand and market.' },
        { icon: '✅', title: 'Configurable approval workflows', desc: 'Sequential or parallel flows. Automatic deadlines. Reminders. Digital approval with full audit trail.' },
        { icon: '🔍', title: 'Technical verification in-platform', desc: 'Pantone/CMYK, barcodes, QR codes, braille and dielines. Catch errors before they reach production.' },
        { icon: '📊', title: 'Executive KPI dashboards', desc: 'At-risk projects, bottlenecks, time per phase. Visibility that C-Level has never had before.' },
      ],
      cta_title: 'What is it costing you?',
      cta_sub: "We'll calculate it together in 20 minutes — straight to the numbers that matter for your sector",
      cta: 'Book a free analysis →',
    },
    fr: {
      badge: 'ROI Calculé',
      headline: 'Votre entreprise perd du temps et de l\'argent<br>à valider des packagings',
      subline: "Pas à l'imprimerie. Pas en design. Dans le processus. Et vous ne l'avez probablement jamais mesuré.",
      greeting: 'Bonjour {{nombre}},',
      intro: 'Nous avons analysé des données d\'entreprises avec plus de 100 SKUs actifs en FMCG, Pharma, Cosmétique et Retail. Les chiffres parlent d\'eux-mêmes :',
      metrics: [
        { num: '−45%', label: 'time-to-market', sub: 'sur les lancements packaging' },
        { num: '−85%', label: 'itérations', sub: 'dans le processus de validation' },
        { num: '−75%', label: 'd\'erreurs', sub: 'sur les artworks envoyés en production' },
        { num: '−50%', label: 'de coûts', sub: 'de gestion du processus' },
      ],
      mid1: "Chaque jour qu'un packaging attend sa validation est un jour absent du rayon. Fenêtres de marché perdues, campagnes désynchronisées, impressions répétées à cause d'erreurs détectées trop tard.",
      mid2: "Le problème de fond est toujours le même : <strong style='color:#1e293b'>marketing, design, qualité et réglementaire travaillent sur des fichiers différents.</strong> Personne n'a la version définitive avant qu'il soit trop tard pour la modifier.",
      features: [
        { icon: '🗂️', title: 'Un référentiel unique d\'artworks', desc: 'Contrôle de versions automatique. Fin des "artwork_final_v14_OK.pdf". Permissions par rôle, filtres par marque et marché.' },
        { icon: '✅', title: 'Workflows de validation configurables', desc: 'Flux séquentiels ou parallèles. Deadlines automatiques. Rappels. Validation digitale avec audit trail complet.' },
        { icon: '🔍', title: 'Vérification technique en plateforme', desc: 'Pantone/CMYK, codes-barres, QR codes, braille et dielines. Détectez les erreurs avant la production.' },
        { icon: '📊', title: 'Tableaux de bord KPI exécutifs', desc: 'Projets à risque, goulots d\'étranglement, temps par phase. Une visibilité que le C-Level n\'a jamais eue.' },
      ],
      cta_title: 'Combien cela vous coûte-t-il ?',
      cta_sub: 'Calculons ensemble en 20 minutes — directement sur les chiffres qui comptent pour votre secteur',
      cta: 'Réserver une analyse gratuite →',
    },
  },

  // ── TEMPLATE 3: FUTURE (Aspiracional dark mode)
  future: {
    es: {
      badge: 'Artwork Proofing Platform · 2026',
      headline: 'Las marcas que ganan ya no aprueban<br><span>packaging en email</span>',
      subline: 'El mercado exige velocidad. Los procesos legacy de aprobación ya no pueden sostenerla.',
      greeting: 'Hola {{nombre}},',
      intro: 'Los equipos de packaging y marketing más ágiles tienen algo en común: han reemplazado los procesos manuales de revisión por una plataforma diseñada específicamente para la velocidad de lanzamiento.',
      pillars: [
        { icon: '🚀', title: '−45% time-to-market en lanzamientos', body: 'Cuando el artwork llega antes al mercado, capturas la ventana comercial mientras tus competidores siguen en la quinta ronda de revisión.' },
        { icon: '🔒', title: 'Trazabilidad total, riesgo legal cero', body: 'Audit trail inmutable. Cada versión, cada comentario, cada aprobación queda registrada. Compliance y auditorías resueltas en segundos.' },
        { icon: '🔬', title: 'Verificación técnica integrada', body: 'Pantone/CMYK, códigos de barras GS1, QR, braille y dielines verificados en la misma plataforma. Sin herramientas externas.' },
        { icon: '🤝', title: 'Toda la cadena en un solo espacio', body: 'Marketing, Calidad, Regulatory, agencias y supply chain. Sin cuentas adicionales. Aprobación con un clic desde cualquier dispositivo.' },
      ],
      quote: '"Pasamos de 8 días de media por aprobación de packaging a menos de 3. Y lo que más valoran nuestros directores es tener trazabilidad completa por primera vez."',
      quote_author: '— Packaging Manager, empresa líder en el sector de gran consumo',
      cta: 'Descubrir cómo funciona →',
      cta_sub: '20 min · Demo personalizada para vuestro sector · Sin compromiso',
    },
    en: {
      badge: 'Artwork Proofing Platform · 2026',
      headline: 'Winning brands no longer approve<br><span>packaging by email</span>',
      subline: "The market demands speed. Legacy approval processes can no longer sustain it.",
      greeting: 'Hi {{nombre}},',
      intro: 'The most agile packaging and marketing teams share one thing: they\'ve replaced manual review processes with a platform built specifically for launch speed.',
      pillars: [
        { icon: '🚀', title: '−45% time-to-market on launches', body: "When artwork reaches the market faster, you capture the commercial window while competitors are still on their fifth revision round." },
        { icon: '🔒', title: 'Total traceability, zero legal risk', body: 'Immutable audit trail. Every version, every comment, every approval recorded. Compliance and audits resolved in seconds.' },
        { icon: '🔬', title: 'Integrated technical verification', body: 'Pantone/CMYK, GS1 barcodes, QR codes, braille and dielines verified in the same platform. No external tools needed.' },
        { icon: '🤝', title: 'The entire chain in one space', body: 'Marketing, Quality, Regulatory, agencies and supply chain. No extra accounts. One-click approval from any device.' },
      ],
      quote: '"We went from an average of 8 days per packaging approval to under 3. And what our directors value most is having full traceability for the first time."',
      quote_author: '— Packaging Manager, leading FMCG company',
      cta: 'See how it works →',
      cta_sub: '20 min · Personalised demo for your sector · No commitment',
    },
    fr: {
      badge: 'Artwork Proofing Platform · 2026',
      headline: 'Les marques qui gagnent ne valident plus<br><span>leurs packagings par email</span>',
      subline: "Le marché exige de la vitesse. Les processus de validation legacy ne peuvent plus suivre.",
      greeting: 'Bonjour {{nombre}},',
      intro: 'Les équipes packaging et marketing les plus agiles ont un point commun : elles ont remplacé les processus manuels de révision par une plateforme conçue spécifiquement pour la vitesse de lancement.',
      pillars: [
        { icon: '🚀', title: '−45% de time-to-market sur les lancements', body: "Quand l'artwork arrive plus vite sur le marché, vous saisissez la fenêtre commerciale pendant que vos concurrents sont encore à leur cinquième cycle de révision." },
        { icon: '🔒', title: 'Traçabilité totale, risque légal zéro', body: 'Audit trail immuable. Chaque version, chaque commentaire, chaque validation enregistrée. Conformité et audits résolus en quelques secondes.' },
        { icon: '🔬', title: 'Vérification technique intégrée', body: 'Pantone/CMYK, codes-barres GS1, QR codes, braille et dielines vérifiés dans la même plateforme. Aucun outil externe nécessaire.' },
        { icon: '🤝', title: 'Toute la chaîne dans un seul espace', body: 'Marketing, Qualité, Réglementaire, agences et supply chain. Sans comptes supplémentaires. Validation en un clic depuis n\'importe quel appareil.' },
      ],
      quote: '"Nous sommes passés de 8 jours en moyenne par validation packaging à moins de 3. Ce que nos directeurs apprécient le plus, c\'est d\'avoir enfin une traçabilité complète."',
      quote_author: '— Packaging Manager, entreprise leader en grande consommation',
      cta: 'Découvrir comment ça marche →',
      cta_sub: '20 min · Démo personnalisée pour votre secteur · Sans engagement',
    },
  },

  // ── TEMPLATE 4: DIRECT (Pregunta directa — follow-up personal)
  direct: {
    es: {
      greeting: 'Hola {{nombre}},',
      p1: 'Hace unos días te escribí sobre MyMediaConnect — la plataforma de artwork proofing que usan los equipos de packaging y marketing para eliminar los cuellos de botella en la aprobación de artes.',
      p2: 'Quería preguntarte algo directo:',
      question: '¿Cuál es vuestro mayor dolor ahora mismo cuando gestionáis la aprobación de packaging?',
      options: [
        { emoji: '🗂️', text: 'Versiones duplicadas — nadie sabe qué archivo es el definitivo' },
        { emoji: '⏳', text: 'Aprobaciones que se eternizan — sin visibilidad de quién está bloqueando' },
        { emoji: '⚠️', text: 'Errores detectados tarde — artes incorrectos que llegan a producción' },
        { emoji: '🔍', text: 'Sin trazabilidad — imposible demostrar quién aprobó qué en una auditoría' },
        { emoji: '📅', text: 'En este momento no es un problema urgente para nosotros' },
      ],
      closing: 'Si alguno de estos resuena, estaré encantado de mostrarte cómo lo resolvemos en 20 minutos — sin presentaciones largas, directo al problema concreto de vuestro sector.',
      sig_name: 'Guillaume',
      sig_title: 'MyMediaConnect · guillaume@mymediaconnect.com',
    },
    en: {
      greeting: 'Hi {{nombre}},',
      p1: 'A few days ago I wrote to you about MyMediaConnect — the artwork proofing platform that packaging and marketing teams use to eliminate bottlenecks in artwork approval.',
      p2: 'I wanted to ask you something directly:',
      question: 'What is your biggest pain point right now when managing packaging approvals?',
      options: [
        { emoji: '🗂️', text: 'Duplicate versions — nobody knows which file is the definitive one' },
        { emoji: '⏳', text: 'Approvals that drag on forever — no visibility on who is blocking' },
        { emoji: '⚠️', text: 'Errors detected too late — incorrect artwork reaching production' },
        { emoji: '🔍', text: 'No traceability — impossible to prove who approved what in an audit' },
        { emoji: '📅', text: 'It\'s not an urgent problem for us right now' },
      ],
      closing: "If any of these resonates, I'd be happy to show you how we solve it in 20 minutes — no long presentations, straight to the specific problem for your sector.",
      sig_name: 'Guillaume',
      sig_title: 'MyMediaConnect · guillaume@mymediaconnect.com',
    },
    fr: {
      greeting: 'Bonjour {{nombre}},',
      p1: "Il y a quelques jours je vous ai écrit au sujet de MyMediaConnect — la plateforme d'artwork proofing qu'utilisent les équipes packaging et marketing pour éliminer les goulots d'étranglement dans la validation des artworks.",
      p2: 'Je voulais vous poser une question directe :',
      question: "Quel est votre plus grand point de douleur en ce moment dans la gestion de vos validations packaging ?",
      options: [
        { emoji: '🗂️', text: "Versions dupliquées — personne ne sait quel fichier est le définitif" },
        { emoji: '⏳', text: "Validations qui s'éternisent — sans visibilité sur qui bloque" },
        { emoji: '⚠️', text: "Erreurs détectées trop tard — artworks incorrects qui partent en production" },
        { emoji: '🔍', text: "Pas de traçabilité — impossible de prouver qui a validé quoi lors d'un audit" },
        { emoji: '📅', text: "Ce n'est pas un problème urgent pour nous en ce moment" },
      ],
      closing: "Si l'un de ces points vous parle, je serais ravi de vous montrer comment nous le résolvons en 20 minutes — sans présentation longue, directement sur le problème concret de votre secteur.",
      sig_name: 'Guillaume',
      sig_title: 'MyMediaConnect · guillaume@mymediaconnect.com',
    },
  },

  // ── TEMPLATE 6: COMPLIANCE (Audit trail y trazabilidad legal)
  compliance: {
    es: {
      badge: 'Compliance & Trazabilidad',
      headline: '¿Puedes demostrar quién aprobó<br>cada packaging y cuándo?',
      subline: 'Auditorías, reguladores e inspecciones. La respuesta correcta no debería tardar horas.',
      greeting: 'Hola {{nombre}},',
      intro: 'En los sectores con packaging regulado — Pharma, OTC, Cosmética, Alimentación — las preguntas de compliance llegan en el momento menos oportuno:',
      questions: [
        '¿Cuál era la versión del arte aprobada antes del lanzamiento?',
        '¿Quién de Regulatory dio el visto bueno y en qué fecha?',
        '¿Hay constancia del cambio de texto legal de la campaña anterior?',
        '¿Podéis demostrar que ninguna versión no aprobada llegó a producción?',
      ],
      midtext: 'Si estas preguntas requieren buscar en emails, carpetas compartidas o WhatsApp, vuestra empresa tiene un <strong style="color:#1e293b">riesgo de compliance que se puede materializar en cualquier momento.</strong>',
      solution_title: 'MyMediaConnect resuelve esto con:',
      solutions: [
        { icon: '🔒', title: 'Audit trail inmutable', desc: 'Cada versión, comentario y aprobación queda registrada con firma digital, timestamp y rol del aprobador. Imposible de alterar.' },
        { icon: '📋', title: 'Historial de versiones completo', desc: 'Visualiza qué fue aprobado, qué fue rechazado y por qué. Con comparación visual pixel-perfect entre versiones.' },
        { icon: '🎯', title: 'Flujos secuenciales por rol', desc: 'Regulatory aprueba después de Marketing y antes de Producción. Sin atajos posibles. Sin excepciones.' },
        { icon: '⚡', title: 'Reporting de compliance instantáneo', desc: 'Exporta el historial de aprobaciones en segundos. Tu equipo jurídico lo agradecerá.' },
      ],
      cta: '¿Tienes 20 min esta semana? →',
      cta_note: 'Demo enfocada en compliance para tu sector regulado',
    },
    en: {
      badge: 'Compliance & Traceability',
      headline: 'Can you prove who approved<br>each packaging and when?',
      subline: 'Audits, regulators and inspections. The right answer should not take hours to find.',
      greeting: 'Hi {{nombre}},',
      intro: 'In sectors with regulated packaging — Pharma, OTC, Cosmetics, Food — compliance questions arrive at the worst possible moment:',
      questions: [
        'Which artwork version was approved before the launch?',
        'Who in Regulatory signed off, and on what date?',
        'Is there a record of the legal text change from the previous campaign?',
        'Can you prove that no unapproved version reached production?',
      ],
      midtext: "If these questions require searching emails, shared drives or WhatsApp, your company has a <strong style='color:#1e293b'>compliance risk that can materialise at any time.</strong>",
      solution_title: 'MyMediaConnect solves this with:',
      solutions: [
        { icon: '🔒', title: 'Immutable audit trail', desc: 'Every version, comment and approval is recorded with a digital signature, timestamp and approver role. Cannot be altered.' },
        { icon: '📋', title: 'Complete version history', desc: 'See what was approved, what was rejected and why. With pixel-perfect visual comparison between versions.' },
        { icon: '🎯', title: 'Sequential role-based flows', desc: 'Regulatory approves after Marketing and before Production. No shortcuts possible. No exceptions.' },
        { icon: '⚡', title: 'Instant compliance reporting', desc: 'Export the approval history in seconds. Your legal team will thank you.' },
      ],
      cta: 'Got 20 min this week? →',
      cta_note: 'Compliance-focused demo for your regulated sector',
    },
    fr: {
      badge: 'Conformité & Traçabilité',
      headline: 'Pouvez-vous prouver qui a validé<br>chaque packaging et quand ?',
      subline: 'Audits, régulateurs et inspections. La bonne réponse ne devrait pas demander des heures.',
      greeting: 'Bonjour {{nombre}},',
      intro: 'Dans les secteurs à packaging réglementé — Pharma, OTC, Cosmétique, Alimentaire — les questions de conformité arrivent au pire moment :',
      questions: [
        "Quelle version de l'artwork était approuvée avant le lancement ?",
        "Qui dans le Réglementaire a donné son accord, et à quelle date ?",
        "Y a-t-il une trace de la modification du texte légal de la campagne précédente ?",
        "Pouvez-vous prouver qu'aucune version non approuvée n'est partie en production ?",
      ],
      midtext: "Si ces questions nécessitent de fouiller des emails, des dossiers partagés ou WhatsApp, votre entreprise a un <strong style='color:#1e293b'>risque de conformité qui peut se matérialiser à tout moment.</strong>",
      solution_title: 'MyMediaConnect résout cela avec :',
      solutions: [
        { icon: '🔒', title: 'Audit trail immuable', desc: 'Chaque version, commentaire et validation est enregistré avec signature digitale, horodatage et rôle du valideur. Impossible à modifier.' },
        { icon: '📋', title: 'Historique complet des versions', desc: "Visualisez ce qui a été approuvé, rejeté et pourquoi. Avec comparaison visuelle pixel-perfect entre versions." },
        { icon: '🎯', title: 'Flux séquentiels par rôle', desc: 'Le Réglementaire approuve après Marketing et avant Production. Sans raccourcis possibles. Sans exceptions.' },
        { icon: '⚡', title: 'Reporting de conformité instantané', desc: "Exportez l'historique des validations en quelques secondes. Votre équipe juridique vous en sera reconnaissante." },
      ],
      cta: 'Disponible 20 min cette semaine ? →',
      cta_note: 'Démo axée conformité pour votre secteur réglementé',
    },
  },

  // ── TEMPLATE 7: SECTORS (Personalización por sector)
  sectors: {
    es: {
      badge: 'Líderes de sector',
      headline: 'Los equipos de packaging más ágiles<br>de tu sector ya lo usan',
      subline: 'MyMediaConnect está diseñado para sectores con alta complejidad de packaging: FMCG, Pharma, Cosmética, Retail y más.',
      greeting: 'Hola {{nombre}},',
      intro: 'La gestión de packaging tiene sus propias reglas según el sector. No es lo mismo gestionar 20 referencias que 500. No es lo mismo una revisión interna que una con agencia internacional y regulatory de cuatro países.',
      sectors_data: [
        { icon: '🛒', name: 'FMCG & Gran Consumo', pain: 'Lanzamientos masivos. Artwork multimarket. Coordinación con agencias externas. Time-to-market crítico.' },
        { icon: '💊', name: 'Pharma & OTC', pain: 'Textos legales regulados. Audit trail obligatorio. Aprobación secuencial Regulatory + Marketing + Calidad.' },
        { icon: '💄', name: 'Cosmética & Beauty', pain: 'Colecciones rápidas. Packaging premium. Multi-idioma. Revisión pixel-perfect de Pantone y acabados.' },
        { icon: '🏪', name: 'Retail & MDD', pain: 'Cientos de referencias propias. Proveedores externos. Versiones por tienda. Control de calidad en producción.' },
      ],
      midtext: 'Independientemente del sector, el problema de fondo es el mismo: <strong style="color:#1e293b">el proceso de aprobación de packaging no está diseñado para la velocidad y complejidad que exige el mercado actual.</strong>',
      metrics: ['−45% time-to-market', '−85% iteraciones', '−75% errores artes', '−50% costes gestión'],
      cta: '¿Tienes 20 min para una demo de tu sector? →',
      cta_note: 'Te mostramos casos reales de tu industria · Sin compromiso',
    },
    en: {
      badge: 'Sector leaders',
      headline: 'The most agile packaging teams<br>in your sector already use it',
      subline: 'MyMediaConnect is built for sectors with high packaging complexity: FMCG, Pharma, Cosmetics, Retail and more.',
      greeting: 'Hi {{nombre}},',
      intro: "Packaging management has its own rules depending on the sector. Managing 20 references is not the same as 500. An internal review is not the same as one involving an international agency and four-country regulatory.",
      sectors_data: [
        { icon: '🛒', name: 'FMCG & Consumer Goods', pain: 'Mass launches. Multi-market artwork. Coordination with external agencies. Critical time-to-market.' },
        { icon: '💊', name: 'Pharma & OTC', pain: 'Regulated legal texts. Mandatory audit trail. Sequential Regulatory + Marketing + Quality approval.' },
        { icon: '💄', name: 'Cosmetics & Beauty', pain: 'Fast collections. Premium packaging. Multi-language. Pixel-perfect review of Pantone and finishes.' },
        { icon: '🏪', name: 'Retail & Private Label', pain: 'Hundreds of own-label references. External suppliers. Store variants. Quality control in production.' },
      ],
      midtext: "Regardless of sector, the underlying problem is the same: <strong style='color:#1e293b'>the packaging approval process is not built for the speed and complexity today's market demands.</strong>",
      metrics: ['−45% time-to-market', '−85% iterations', '−75% artwork errors', '−50% management costs'],
      cta: 'Got 20 min for a sector-specific demo? →',
      cta_note: 'We show you real cases from your industry · No commitment',
    },
    fr: {
      badge: 'Leaders de secteur',
      headline: 'Les équipes packaging les plus agiles<br>de votre secteur l\'utilisent déjà',
      subline: 'MyMediaConnect est conçu pour les secteurs à forte complexité packaging : FMCG, Pharma, Cosmétique, Retail et plus encore.',
      greeting: 'Bonjour {{nombre}},',
      intro: "La gestion du packaging a ses propres règles selon le secteur. Gérer 20 références n'est pas la même chose que 500. Une révision interne n'est pas la même chose qu'une impliquant une agence internationale et le réglementaire de quatre pays.",
      sectors_data: [
        { icon: '🛒', name: 'FMCG & Grande Consommation', pain: 'Lancements massifs. Artworks multi-marchés. Coordination avec agences externes. Time-to-market critique.' },
        { icon: '💊', name: 'Pharma & OTC', pain: 'Textes légaux réglementés. Audit trail obligatoire. Validation séquentielle Réglementaire + Marketing + Qualité.' },
        { icon: '💄', name: 'Cosmétique & Beauté', pain: 'Collections rapides. Packaging premium. Multi-langue. Révision pixel-perfect des Pantone et finitions.' },
        { icon: '🏪', name: 'Retail & MDD', pain: "Des centaines de références propres. Fournisseurs externes. Versions par enseigne. Contrôle qualité en production." },
      ],
      midtext: "Quel que soit le secteur, le problème de fond est le même : <strong style='color:#1e293b'>le processus de validation packaging n'est pas conçu pour la vitesse et la complexité qu'exige le marché actuel.</strong>",
      metrics: ['−45% time-to-market', '−85% itérations', '−75% erreurs artworks', '−50% coûts gestion'],
      cta: 'Disponible 20 min pour une démo de votre secteur ? →',
      cta_note: 'Nous vous montrons des cas réels de votre industrie · Sans engagement',
    },
  },

  // ── TEMPLATE 8: DIGITAL (Transformación digital del proceso)
  digital: {
    es: {
      badge: 'Transformación Digital · Packaging',
      headline: 'Tu ERP está digitalizado.<br>Tu packaging sigue en email.',
      subline: 'La última milla de la digitalización del producto físico todavía pasa por adjuntos y cadenas de correo.',
      greeting: 'Hola {{nombre}},',
      p1: 'Las empresas con las que hablamos tienen ya SAP, PIM o ERP actualizados. Tienen DAM para activos digitales. Tienen BI para datos de ventas.',
      p2: 'Pero el proceso de aprobación de packaging — la última barrera antes de que el producto llegue al lineal — sigue funcionando con emails, carpetas compartidas y hojas de Excel.',
      gap_title: 'La brecha digital del packaging',
      gap_items: [
        { before: 'Sistema ERP actualizado', after: 'Artwork por email y WhatsApp' },
        { before: 'DAM para assets digitales', after: 'Versiones finales en carpetas locales' },
        { before: 'BI para decisiones de negocio', after: 'Sin visibilidad del estado de artes' },
        { before: 'Integración con proveedores', after: 'Feedback de agencias por email' },
      ],
      solution: 'MyMediaConnect cierra esa brecha. Es la capa especializada que conecta tu equipo interno, tus agencias y tu supply chain en un único flujo digital trazable — desde el brief de arte hasta la aprobación final para producción.',
      integrations: ['ERP / SAP', 'PIM', 'DAM existente', 'Agencias externas', 'Proveedores', 'Supply chain'],
      cta: '¿Cómo encaja en vuestro stack? Lo vemos en 20 min →',
      cta_note: 'Demo técnica adaptada a vuestra arquitectura',
    },
    en: {
      badge: 'Digital Transformation · Packaging',
      headline: 'Your ERP is digitalised.<br>Your packaging is still in email.',
      subline: 'The last mile of physical product digitalisation still goes through attachments and email chains.',
      greeting: 'Hi {{nombre}},',
      p1: 'The companies we talk to already have updated SAP, PIM or ERP systems. They have DAM for digital assets. They have BI for sales data.',
      p2: "But the packaging approval process — the last barrier before the product reaches the shelf — still runs on emails, shared drives and Excel spreadsheets.",
      gap_title: "Packaging's digital gap",
      gap_items: [
        { before: 'Updated ERP system', after: 'Artwork via email and WhatsApp' },
        { before: 'DAM for digital assets', after: 'Final versions in local folders' },
        { before: 'BI for business decisions', after: 'No visibility of artwork status' },
        { before: 'Integration with suppliers', after: 'Agency feedback by email' },
      ],
      solution: 'MyMediaConnect closes that gap. It is the specialised layer that connects your internal team, agencies and supply chain in a single traceable digital flow — from the artwork brief to final production approval.',
      integrations: ['ERP / SAP', 'PIM', 'Existing DAM', 'External agencies', 'Suppliers', 'Supply chain'],
      cta: 'How does it fit into your stack? See it in 20 min →',
      cta_note: 'Technical demo adapted to your architecture',
    },
    fr: {
      badge: 'Transformation Digitale · Packaging',
      headline: 'Votre ERP est digitalisé.<br>Votre packaging passe encore par email.',
      subline: 'Le dernier kilomètre de la digitalisation du produit physique passe encore par des pièces jointes et des chaînes d\'emails.',
      greeting: 'Bonjour {{nombre}},',
      p1: 'Les entreprises avec qui nous discutons ont déjà SAP, PIM ou ERP à jour. Elles ont un DAM pour les assets digitaux. Elles ont de la BI pour les données de vente.',
      p2: "Mais le processus de validation packaging — la dernière barrière avant que le produit arrive en rayon — fonctionne encore avec des emails, des dossiers partagés et des feuilles Excel.",
      gap_title: "Le fossé digital du packaging",
      gap_items: [
        { before: 'Système ERP à jour', after: 'Artworks par email et WhatsApp' },
        { before: 'DAM pour assets digitaux', after: 'Versions finales dans des dossiers locaux' },
        { before: 'BI pour les décisions business', after: "Aucune visibilité sur l'état des artworks" },
        { before: 'Intégration avec les fournisseurs', after: 'Retours agences par email' },
      ],
      solution: 'MyMediaConnect comble ce fossé. C\'est la couche spécialisée qui connecte votre équipe interne, vos agences et votre supply chain dans un flux digital unique et traçable — du brief artwork à la validation finale pour production.',
      integrations: ['ERP / SAP', 'PIM', 'DAM existant', 'Agences externes', 'Fournisseurs', 'Supply chain'],
      cta: 'Comment s\'intègre-t-il dans votre stack ? Voyons ça en 20 min →',
      cta_note: 'Démo technique adaptée à votre architecture',
    },
  },

  // ── TEMPLATE 9: TEAM (Colaboración interna y externa)
  team: {
    es: {
      badge: 'Colaboración · Packaging Teams',
      headline: 'Tu equipo de packaging trabaja en silos.<br>El packaging lo paga.',
      subline: 'Marketing, diseño, calidad, regulatory, agencias y supply chain: todos esenciales, todos desconectados.',
      greeting: 'Hola {{nombre}},',
      intro: 'Cuando preguntamos a los equipos de packaging cuál es su mayor problema, la respuesta no suele ser técnica. Es organizativa:',
      pains: [
        '"Regulatory tiene la versión 11, marketing tiene la 12 y la agencia está trabajando en la 13."',
        '"No sé si el comentario de calidad ya fue incorporado en el arte o si sigue pendiente."',
        '"El proveedor de producción me pide confirmación del arte final, pero Regulatory aún no ha dado el OK."',
        '"Llevamos dos semanas en el mismo ciclo de revisión porque los comentarios llegan uno a uno."',
      ],
      solution_title: 'Un solo espacio para todos',
      features: [
        { icon: '👥', title: 'Equipos internos y externos', desc: 'Marketing, calidad, regulatory, agencias y proveedores en el mismo flujo. Sin cuentas adicionales para externos.' },
        { icon: '💬', title: 'Comentarios sobre el arte', desc: 'Anotaciones directamente sobre el packaging. @menciones. Hilo por versión. Sin emails cruzados.' },
        { icon: '🔄', title: 'Flujos configurables', desc: 'Secuencial o paralelo según el proyecto. Quién aprueba, en qué orden, con qué deadline.' },
        { icon: '📱', title: 'Aprobación en un clic', desc: 'Desde cualquier dispositivo. Sin necesidad de abrir el archivo. Registro automático.' },
      ],
      cta: 'Muéstrame cómo funciona con mi tipo de equipo →',
      cta_note: '20 min · Demo con el flujo de tu equipo real',
    },
    en: {
      badge: 'Collaboration · Packaging Teams',
      headline: 'Your packaging team works in silos.<br>The packaging pays for it.',
      subline: 'Marketing, design, quality, regulatory, agencies and supply chain: all essential, all disconnected.',
      greeting: 'Hi {{nombre}},',
      intro: "When we ask packaging teams what their biggest problem is, the answer is rarely technical. It's organisational:",
      pains: [
        '"Regulatory has version 11, marketing has version 12 and the agency is working on version 13."',
        '"I don\'t know if the quality comment has been incorporated into the artwork or if it\'s still pending."',
        '"The production supplier is asking me for final artwork confirmation, but Regulatory hasn\'t given the green light yet."',
        '"We\'ve been in the same review cycle for two weeks because comments come in one by one."',
      ],
      solution_title: 'One single space for everyone',
      features: [
        { icon: '👥', title: 'Internal and external teams', desc: 'Marketing, quality, regulatory, agencies and suppliers in the same flow. No extra accounts for externals.' },
        { icon: '💬', title: 'Comments on the artwork', desc: 'Annotations directly on the packaging. @mentions. Thread per version. No crossed emails.' },
        { icon: '🔄', title: 'Configurable flows', desc: 'Sequential or parallel depending on the project. Who approves, in what order, with what deadline.' },
        { icon: '📱', title: 'One-click approval', desc: 'From any device. No need to open the file. Automatic record.' },
      ],
      cta: 'Show me how it works with my type of team →',
      cta_note: '20 min · Demo with your real team flow',
    },
    fr: {
      badge: 'Collaboration · Équipes Packaging',
      headline: 'Votre équipe packaging travaille en silos.<br>Le packaging en fait les frais.',
      subline: 'Marketing, design, qualité, réglementaire, agences et supply chain : tous indispensables, tous déconnectés.',
      greeting: 'Bonjour {{nombre}},',
      intro: "Quand nous demandons aux équipes packaging quel est leur plus grand problème, la réponse est rarement technique. Elle est organisationnelle :",
      pains: [
        '"Le réglementaire a la version 11, marketing a la 12 et l\'agence travaille sur la 13."',
        '"Je ne sais pas si le commentaire qualité a été intégré dans l\'artwork ou s\'il est encore en attente."',
        '"Le fournisseur de production me demande la confirmation de l\'artwork final, mais le Réglementaire n\'a pas encore donné son accord."',
        '"Nous sommes dans le même cycle de révision depuis deux semaines parce que les commentaires arrivent un par un."',
      ],
      solution_title: 'Un seul espace pour tout le monde',
      features: [
        { icon: '👥', title: 'Équipes internes et externes', desc: 'Marketing, qualité, réglementaire, agences et fournisseurs dans le même flux. Sans comptes supplémentaires pour les externes.' },
        { icon: '💬', title: 'Commentaires sur l\'artwork', desc: 'Annotations directement sur le packaging. @mentions. Fil par version. Sans emails croisés.' },
        { icon: '🔄', title: 'Flux configurables', desc: 'Séquentiel ou parallèle selon le projet. Qui valide, dans quel ordre, avec quel délai.' },
        { icon: '📱', title: 'Validation en un clic', desc: "Depuis n'importe quel appareil. Sans avoir à ouvrir le fichier. Enregistrement automatique." },
      ],
      cta: 'Montrez-moi comment ça fonctionne avec mon type d\'équipe →',
      cta_note: '20 min · Démo avec le flux de votre équipe réelle',
    },
  },

  // ── TEMPLATE 10: CEO (Visibilidad ejecutiva y ROI estratégico)
  ceo: {
    es: {
      badge: 'C-Level · Visibilidad Estratégica',
      headline: '¿Cuánto os está costando realmente<br>la gestión del packaging?',
      subline: 'No en la imprenta. En las horas perdidas, las tiradas repetidas y los retrasos que nadie cuantifica.',
      greeting: 'Hola {{nombre}},',
      intro: 'Como Director General o COO, probablemente conoces el resultado pero no el proceso que lo genera: retrasos en el lanzamiento de productos, tiradas corregidas por errores en artes finales, recursos de marketing bloqueados esperando aprobaciones.',
      kpis: [
        { num: '−45%', label: 'Reducción de time-to-market', context: 'Captura ventanas comerciales mientras competidores siguen en revisión' },
        { num: '−85%', label: 'Menos iteraciones de revisión', context: 'De media 6 rondas a menos de 1. Horas de equipo recuperadas.' },
        { num: '−75%', label: 'Errores en artes a producción', context: 'Tiradas repetidas, reproceso y coste evitado' },
        { num: '−50%', label: 'Costes de gestión del proceso', context: 'Tiempo de coordinación, gestión de versiones y seguimiento eliminados' },
      ],
      quote: '"Por primera vez tengo visibilidad real de en qué estado está cada artwork y quién está bloqueando. Antes era imposible saberlo sin preguntar a cuatro personas."',
      quote_role: '— Director de Operaciones, empresa de gran consumo',
      close: 'Si el packaging es un cuello de botella en vuestros lanzamientos, puedo mostrarte en 20 minutos cómo lo hemos resuelto para empresas de tu mismo sector — con métricas reales, sin presentaciones genéricas.',
      cta: '¿Cuándo tienes 20 minutos? →',
      cta_note: 'Análisis de impacto adaptado a vuestro volumen de lanzamientos',
    },
    en: {
      badge: 'C-Level · Strategic Visibility',
      headline: 'What is packaging management<br>really costing you?',
      subline: "Not at the printer. In the wasted hours, repeated print runs and delays that nobody quantifies.",
      greeting: 'Hi {{nombre}},',
      intro: "As a CEO or COO, you probably know the outcome but not the process behind it: product launch delays, corrected print runs due to artwork errors, marketing resources stuck waiting for approvals.",
      kpis: [
        { num: '−45%', label: 'Time-to-market reduction', context: 'Capture commercial windows while competitors are still in review' },
        { num: '−85%', label: 'Fewer review iterations', context: 'From an average of 6 rounds to less than 1. Team hours recovered.' },
        { num: '−75%', label: 'Artwork errors reaching production', context: 'Repeated print runs, rework and avoided cost' },
        { num: '−50%', label: 'Process management costs', context: 'Coordination time, version management and follow-up eliminated' },
      ],
      quote: '"For the first time I have real visibility of where each artwork stands and who is blocking it. Before, it was impossible to know without asking four people."',
      quote_role: '— Operations Director, FMCG company',
      close: "If packaging is a bottleneck in your launches, I can show you in 20 minutes how we've solved it for companies in your sector — with real metrics, no generic presentations.",
      cta: 'When do you have 20 minutes? →',
      cta_note: 'Impact analysis adapted to your launch volume',
    },
    fr: {
      badge: 'C-Level · Visibilité Stratégique',
      headline: 'Combien vous coûte vraiment<br>la gestion du packaging ?',
      subline: "Pas à l'imprimerie. Dans les heures perdues, les impressions répétées et les retards que personne ne quantifie.",
      greeting: 'Bonjour {{nombre}},',
      intro: "En tant que Directeur Général ou COO, vous connaissez probablement le résultat mais pas le processus qui le génère : retards de lancement produit, impressions corrigées à cause d'erreurs dans les artworks finals, ressources marketing bloquées en attente de validations.",
      kpis: [
        { num: '−45%', label: 'Réduction du time-to-market', context: 'Saisissez les fenêtres commerciales pendant que vos concurrents sont encore en révision' },
        { num: '−85%', label: "Moins d'itérations de révision", context: "En moyenne 6 cycles à moins d'1. Des heures d'équipe récupérées." },
        { num: '−75%', label: "Erreurs d'artworks en production", context: 'Impressions répétées, reprises et coût évité' },
        { num: '−50%', label: 'Coûts de gestion du processus', context: 'Temps de coordination, gestion des versions et suivi éliminés' },
      ],
      quote: '"Pour la première fois j\'ai une visibilité réelle sur l\'état de chaque artwork et sur qui bloque. Avant, c\'était impossible à savoir sans demander à quatre personnes."',
      quote_role: '— Directeur des Opérations, entreprise de grande consommation',
      close: "Si le packaging est un goulot d'étranglement dans vos lancements, je peux vous montrer en 20 minutes comment nous l'avons résolu pour des entreprises de votre secteur — avec des métriques réelles, sans présentations génériques.",
      cta: 'Quand avez-vous 20 minutes ? →',
      cta_note: "Analyse d'impact adaptée à votre volume de lancements",
    },
  },

  // ── TEMPLATE 5: SHOWCASE (Antes vs. Después + features)
  showcase: {
    es: {
      headline: 'Del packaging en caos<br>al packaging en control',
      subline: 'Lo que cambia cuando tu equipo trabaja con MyMediaConnect',
      greeting: 'Hola {{nombre}},',
      intro: 'La diferencia entre un proceso de aprobación de packaging moderno y uno legacy no está en las personas ni en las agencias — está en si tienes o no una herramienta diseñada para ello.',
      before_label: '❌ Sin MMC',
      after_label: '✓ Con MMC',
      befores: [
        '"archivo_final_v14_OK_revisado.pdf"',
        'Comentarios por email, WhatsApp y reunión',
        'Regulatory no sabe qué versión aprobar',
        'Producción imprime la versión equivocada',
        'Auditoría: ¿quién aprobó esto? Nadie sabe.',
        '8+ días de media por ciclo de aprobación',
      ],
      afters: [
        'Control de versiones automático y trazable',
        'Comentarios sobre el arte, con @menciones',
        'Flujo secuencial: cada rol aprueba en su turno',
        'Solo llega a producción lo aprobado y firmado',
        'Audit trail completo en dos clics',
        '< 3 días — reducción media del 45%',
      ],
      features_title: 'Módulos de la plataforma',
      features: [
        { icon: '🖼️', title: 'Artwork Proofing', desc: 'Visualización pixel-perfect. Zoom, comparación versiones, Pantone/CMYK, dielines, códigos de barras GS1 y braille.' },
        { icon: '✅', title: 'Workflows de aprobación', desc: 'Flujos secuenciales o paralelos. Checklists. Deadlines. Recordatorios automáticos. Aprobación con un clic.' },
        { icon: '🗄️', title: 'Digital Asset Management', desc: 'Repositorio único. Control de versiones. Permisos por rol. Filtros por marca, mercado y campaña.' },
        { icon: '📊', title: 'Dashboards & Analytics', desc: 'KPIs ejecutivos. Proyectos en riesgo. Cuellos de botella. Reporting de compliance.' },
      ],
      sectors: 'FMCG · Pharma & OTC · Cosmética · Retail/MDD · Electrónica · Suplementos',
      cta_title: 'Vélo funcionando en tu contexto real',
      cta_sub: '20 minutos · Demo personalizada para vuestro tipo de proyectos y sector',
      cta: 'Solicitar demo gratuita →',
      pills: ['Sin tarjeta de crédito', 'Sin contrato', 'Setup en el día'],
    },
    en: {
      headline: 'From packaging chaos<br>to packaging control',
      subline: 'What changes when your team works with MyMediaConnect',
      greeting: 'Hi {{nombre}},',
      intro: "The difference between a modern packaging approval process and a legacy one isn't about the people or agencies involved — it's about whether you have a tool built specifically for it.",
      before_label: '❌ Without MMC',
      after_label: '✓ With MMC',
      befores: [
        '"final_artwork_v14_OK_revised.pdf"',
        'Comments via email, WhatsApp and meetings',
        'Regulatory doesn\'t know which version to approve',
        'Production prints the wrong version',
        'Audit: who approved this? Nobody knows.',
        '8+ days average per approval cycle',
      ],
      afters: [
        'Automatic, traceable version control',
        'Comments on the artwork, with @mentions',
        'Sequential flow: each role approves in turn',
        'Only approved & signed files reach production',
        'Full audit trail in two clicks',
        '< 3 days — average reduction of 45%',
      ],
      features_title: 'Platform modules',
      features: [
        { icon: '🖼️', title: 'Artwork Proofing', desc: 'Pixel-perfect visualisation. Zoom, version comparison, Pantone/CMYK, dielines, GS1 barcodes and braille.' },
        { icon: '✅', title: 'Approval Workflows', desc: 'Sequential or parallel flows. Checklists. Deadlines. Automatic reminders. One-click approval.' },
        { icon: '🗄️', title: 'Digital Asset Management', desc: 'Single repository. Version control. Role-based permissions. Filters by brand, market and campaign.' },
        { icon: '📊', title: 'Dashboards & Analytics', desc: 'Executive KPIs. At-risk projects. Bottlenecks. Compliance reporting.' },
      ],
      sectors: 'FMCG · Pharma & OTC · Cosmetics · Retail/MDD · Electronics · Supplements',
      cta_title: 'See it working in your real context',
      cta_sub: '20 minutes · Personalised demo for your project type and sector',
      cta: 'Request a free demo →',
      pills: ['No credit card', 'No contract', 'Same-day setup'],
    },
    fr: {
      headline: 'Du packaging dans le chaos<br>au packaging sous contrôle',
      subline: 'Ce qui change quand votre équipe travaille avec MyMediaConnect',
      greeting: 'Bonjour {{nombre}},',
      intro: "La différence entre un processus de validation packaging moderne et un processus legacy ne tient pas aux personnes ni aux agences — elle tient au fait d'avoir ou non un outil conçu pour ça.",
      before_label: '❌ Sans MMC',
      after_label: '✓ Avec MMC',
      befores: [
        '"artwork_final_v14_OK_revu.pdf"',
        'Commentaires par email, WhatsApp et réunion',
        "Le réglementaire ne sait pas quelle version valider",
        "La production imprime la mauvaise version",
        "Audit : qui a validé ça ? Personne ne sait.",
        "8+ jours en moyenne par cycle de validation",
      ],
      afters: [
        'Contrôle de versions automatique et traçable',
        'Commentaires sur l\'artwork, avec @mentions',
        'Flux séquentiel : chaque rôle valide à son tour',
        "Seuls les fichiers validés et signés partent en production",
        'Audit trail complet en deux clics',
        '< 3 jours — réduction moyenne de 45%',
      ],
      features_title: 'Modules de la plateforme',
      features: [
        { icon: '🖼️', title: 'Artwork Proofing', desc: 'Visualisation pixel-perfect. Zoom, comparaison de versions, Pantone/CMYK, dielines, codes-barres GS1 et braille.' },
        { icon: '✅', title: 'Workflows de validation', desc: 'Flux séquentiels ou parallèles. Checklists. Deadlines. Rappels automatiques. Validation en un clic.' },
        { icon: '🗄️', title: 'Digital Asset Management', desc: 'Référentiel unique. Contrôle de versions. Permissions par rôle. Filtres par marque, marché et campagne.' },
        { icon: '📊', title: 'Dashboards & Analytics', desc: 'KPIs exécutifs. Projets à risque. Goulots d\'étranglement. Reporting de conformité.' },
      ],
      sectors: 'FMCG · Pharma & OTC · Cosmétique · Retail/MDD · Électronique · Compléments',
      cta_title: 'Voyez-le fonctionner dans votre contexte réel',
      cta_sub: '20 minutes · Démo personnalisée pour votre type de projets et secteur',
      cta: 'Demander une démo gratuite →',
      pills: ['Sans carte bancaire', 'Sans contrat', 'Mise en place le jour même'],
    },
  },
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE BUILDERS
// ─────────────────────────────────────────────────────────────

function buildLoop(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.loop[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrap{max-width:600px;margin:0 auto;background:#0f172a}
    .header{padding:32px 40px 28px;border-bottom:1px solid rgba(255,255,255,.08)}
    .badge{display:inline-block;background:rgba(59,130,246,.15);color:#60a5fa;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:20px;border:1px solid rgba(59,130,246,.25)}
    h1{font-size:30px;font-weight:800;color:white;line-height:1.2;margin:0 0 12px;letter-spacing:-0.5px}
    .subline{font-size:15px;color:#94a3b8;line-height:1.6;margin:0}
    .content{padding:36px 40px}
    p{color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px}
    .loop-box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px 24px;margin-bottom:20px}
    .step{display:flex;align-items:flex-start;margin-bottom:12px}
    .step:last-child{margin-bottom:0}
    .num{background:#ef4444;color:white;min-width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:12px;margin-top:2px}
    .step-text{color:#cbd5e1;font-size:14px;line-height:1.5}
    .vs-box{background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(139,92,246,.08));border:1px solid rgba(59,130,246,.2);border-radius:12px;padding:20px 24px;margin-bottom:28px}
    .vs-title{color:#60a5fa;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
    .check{color:#e2e8f0;font-size:14px;line-height:1.6;padding-left:18px;position:relative;margin-bottom:6px}
    .check:before{content:"✓";position:absolute;left:0;color:#34d399;font-weight:700}
    .cta-wrap{text-align:center;margin:28px 0}
    .cta{display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px}
    .cta-note{color:#475569;font-size:12px;margin-top:10px}
    .footer{padding:24px 40px;border-top:1px solid rgba(255,255,255,.06);text-align:center}
    .footer-text{color:#475569;font-size:12px;line-height:1.6}
    .footer a{color:#475569}
  </style>
</head>
<body><div class="wrap">
  <div class="header">
    ${MMC_LOGO}
    <div style="margin-top:24px">
      <div class="badge">${c.badge}</div>
      <h1>${c.headline}</h1>
      <p class="subline">${c.subline}</p>
    </div>
  </div>
  <div class="content">
    <p>${c.greeting}</p>
    <p>${c.intro}</p>
    <div class="loop-box">
      ${c.steps.map((s, i) => `<div class="step"><div class="num">${i + 1}</div><div class="step-text">${s}</div></div>`).join('')}
    </div>
    <p>${c.midtext}</p>
    <div class="vs-box">
      <div class="vs-title">${c.with_mmc}</div>
      ${c.benefits.map(b => `<div class="check">${b}</div>`).join('')}
    </div>
    <div class="cta-wrap">
      <a href="https://mymediaconnect.com" class="cta">${c.cta}</a>
      <div class="cta-note">${c.cta_note}</div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">${foot}</div>
  </div>
</div></body></html>`
}

function buildROI(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.roi[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrap{max-width:600px;margin:0 auto;background:white}
    .header{background:linear-gradient(135deg,#1e293b,#0f172a);padding:36px 40px}
    .badge{display:inline-block;background:rgba(251,191,36,.15);color:#fbbf24;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:20px;border:1px solid rgba(251,191,36,.3)}
    h1{font-size:28px;font-weight:800;color:white;line-height:1.25;margin:0 0 10px;letter-spacing:-0.5px}
    .subline{font-size:14px;color:#94a3b8;line-height:1.6;margin:0}
    .content{padding:36px 40px}
    p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
    .metrics{display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap}
    .metric{flex:1;min-width:100px;background:#f1f5f9;border-radius:12px;padding:16px 12px;text-align:center}
    .mnum{font-size:26px;font-weight:800;letter-spacing:-1px}
    .mlabel{font-size:12px;color:#64748b;margin-top:4px;font-weight:600}
    .msub{font-size:11px;color:#94a3b8;margin-top:2px}
    .divider{height:1px;background:#f1f5f9;margin:20px 0}
    .feat{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
    .feat-icon{font-size:20px;min-width:36px;height:36px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center}
    .feat-title{font-size:14px;font-weight:600;color:#1e293b;margin-bottom:3px}
    .feat-desc{font-size:13px;color:#64748b;line-height:1.5}
    .cta-box{background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:14px;padding:28px 32px;text-align:center;margin:24px 0}
    .cta-title{color:white;font-size:18px;font-weight:700;margin-bottom:6px}
    .cta-sub{color:#94a3b8;font-size:13px;margin-bottom:20px}
    .cta{display:inline-block;background:#3b82f6;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
    .footer{padding:24px 40px;background:#f8fafc;text-align:center}
    .footer-text{color:#9ca3af;font-size:12px;line-height:1.6}
    .footer a{color:#9ca3af}
  </style>
</head>
<body><div class="wrap">
  <div class="header">
    ${MMC_LOGO}
    <div style="margin-top:24px">
      <div class="badge">${c.badge}</div>
      <h1>${c.headline}</h1>
      <p class="subline">${c.subline}</p>
    </div>
  </div>
  <div class="content">
    <p>${c.greeting}</p>
    <p>${c.intro}</p>
    <div class="metrics">
      ${c.metrics.map((m, i) => {
        const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6']
        return `<div class="metric"><div class="mnum" style="color:${colors[i]}">${m.num}</div><div class="mlabel">${m.label}</div><div class="msub">${m.sub}</div></div>`
      }).join('')}
    </div>
    <p>${c.mid1}</p>
    <p>${c.mid2}</p>
    <div class="divider"></div>
    ${c.features.map(f => `<div class="feat"><div class="feat-icon">${f.icon}</div><div><div class="feat-title">${f.title}</div><div class="feat-desc">${f.desc}</div></div></div>`).join('')}
    <div class="cta-box">
      <div class="cta-title">${c.cta_title}</div>
      <div class="cta-sub">${c.cta_sub}</div>
      <a href="https://mymediaconnect.com" class="cta">${c.cta}</a>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">${foot}</div>
  </div>
</div></body></html>`
}

function buildFuture(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.future[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrap{max-width:600px;margin:0 auto;background:#020617}
    .header{padding:36px 40px 28px;position:relative;overflow:hidden}
    .glow{position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:400px;height:300px;background:radial-gradient(circle,rgba(59,130,246,.12) 0%,transparent 70%);pointer-events:none}
    .badge{display:inline-block;background:rgba(99,102,241,.12);color:#a5b4fc;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:22px;border:1px solid rgba(99,102,241,.2)}
    h1{font-size:32px;font-weight:800;color:white;line-height:1.15;margin:0 0 14px;letter-spacing:-0.8px}
    h1 span{background:linear-gradient(90deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .subline{font-size:15px;color:#475569;line-height:1.6;margin:0}
    .content{padding:32px 40px}
    p{color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px}
    .pillar{border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px 20px;margin-bottom:12px;background:rgba(255,255,255,.02)}
    .ph{display:flex;align-items:center;gap:10px;margin-bottom:7px}
    .pi{font-size:18px}
    .pt{color:#e2e8f0;font-size:14px;font-weight:700}
    .pb{color:#475569;font-size:13px;line-height:1.55}
    .quote{border-left:3px solid #3b82f6;padding:14px 18px;margin:22px 0;background:rgba(59,130,246,.05);border-radius:0 8px 8px 0}
    .quote-text{color:#cbd5e1;font-size:14px;font-style:italic;line-height:1.6;margin:0 0 8px}
    .quote-author{color:#475569;font-size:12px}
    .cta-wrap{text-align:center;margin:28px 0 8px}
    .cta{display:inline-block;background:white;color:#0f172a;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:-0.2px}
    .cta-sub{color:#475569;font-size:12px;text-align:center;margin-top:10px}
    .footer{padding:24px 40px;border-top:1px solid rgba(255,255,255,.05);text-align:center}
    .footer-text{color:#334155;font-size:12px;line-height:1.6}
    .footer a{color:#334155}
  </style>
</head>
<body><div class="wrap">
  <div class="header">
    <div class="glow"></div>
    ${MMC_LOGO}
    <div style="margin-top:22px">
      <div class="badge">${c.badge}</div>
      <h1>${c.headline}</h1>
      <p class="subline">${c.subline}</p>
    </div>
  </div>
  <div class="content">
    <p>${c.greeting}</p>
    <p>${c.intro}</p>
    ${c.pillars.map(p => `<div class="pillar"><div class="ph"><span class="pi">${p.icon}</span><span class="pt">${p.title}</span></div><div class="pb">${p.body}</div></div>`).join('')}
    <div class="quote">
      <div class="quote-text">${c.quote}</div>
      <div class="quote-author">${c.quote_author}</div>
    </div>
    <div class="cta-wrap">
      <a href="https://mymediaconnect.com" class="cta">${c.cta}</a>
      <div class="cta-sub">${c.cta_sub}</div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">${foot}</div>
  </div>
</div></body></html>`
}

function buildDirect(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.direct[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrap{max-width:600px;margin:0 auto;background:white}
    .header{background:#1e293b;padding:24px 40px}
    .content{padding:40px}
    p{color:#374151;font-size:15px;line-height:1.8;margin:0 0 18px}
    .question-box{background:#f0f9ff;border-left:4px solid #3b82f6;border-radius:0 10px 10px 0;padding:16px 20px;margin:20px 0}
    .question-text{color:#1e40af;font-size:15px;font-weight:600;line-height:1.5}
    .option{display:block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:10px;text-decoration:none;color:#374151;font-size:14px;font-weight:500}
    .sig{margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9}
    .sig-name{font-weight:700;color:#1e293b;font-size:15px}
    .sig-title{color:#64748b;font-size:13px;margin-top:2px}
    .footer{padding:20px 40px;background:#f8fafc}
    .footer-text{color:#9ca3af;font-size:12px;line-height:1.6}
    .footer a{color:#9ca3af}
  </style>
</head>
<body><div class="wrap">
  <div class="header">${MMC_LOGO}</div>
  <div class="content">
    <p>${c.greeting}</p>
    <p>${c.p1}</p>
    <p>${c.p2}</p>
    <div class="question-box"><div class="question-text">${c.question}</div></div>
    ${c.options.map(o => `<a href="https://mymediaconnect.com" class="option"><span style="margin-right:8px">${o.emoji}</span>${o.text}</a>`).join('')}
    <p style="margin-top:20px">${c.closing}</p>
    <div class="sig">
      <div class="sig-name">${c.sig_name}</div>
      <div class="sig-title">${c.sig_title}</div>
    </div>
  </div>
  <div class="footer"><div class="footer-text">${foot}</div></div>
</div></body></html>`
}

function buildShowcase(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.showcase[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrap{max-width:600px;margin:0 auto;background:white}
    .header{background:linear-gradient(160deg,#1e293b,#0f172a);padding:32px 40px;text-align:center}
    h1{font-size:26px;font-weight:800;color:white;line-height:1.25;margin:16px 0 8px;letter-spacing:-0.5px}
    .subline{color:#94a3b8;font-size:13px;line-height:1.6}
    .section{padding:32px 40px}
    .stitle{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:16px}
    p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
    .compare{display:flex;gap:10px;margin-bottom:24px}
    .col{flex:1;border-radius:12px;padding:14px}
    .before{background:#fef2f2;border:1px solid #fecaca}
    .after{background:#f0fdf4;border:1px solid #bbf7d0}
    .col-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
    .before .col-label{color:#ef4444}
    .after .col-label{color:#16a34a}
    .col-item{font-size:12px;line-height:1.6;padding:3px 0}
    .before .col-item{color:#991b1b}
    .after .col-item{color:#166534}
    .feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px}
    .feat{background:#f8fafc;border-radius:10px;padding:14px}
    .feat-icon{font-size:20px;margin-bottom:7px}
    .feat-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:3px}
    .feat-desc{font-size:12px;color:#64748b;line-height:1.45}
    .sectors{background:#f1f5f9;border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:center}
    .sectors-text{font-size:12px;color:#64748b;font-weight:500}
    .cta-box{background:#1e293b;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px}
    .cta-title{color:white;font-size:18px;font-weight:800;margin-bottom:6px}
    .cta-sub{color:#64748b;font-size:13px;margin-bottom:18px}
    .cta{display:inline-block;background:#3b82f6;color:white;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
    .pills{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
    .pill{background:rgba(255,255,255,.06);color:#64748b;font-size:11px;padding:4px 10px;border-radius:20px}
    .footer{padding:20px 40px;background:#f8fafc;text-align:center}
    .footer-text{color:#9ca3af;font-size:12px;line-height:1.6}
    .footer a{color:#9ca3af}
  </style>
</head>
<body><div class="wrap">
  <div class="header">
    ${MMC_LOGO}
    <h1>${c.headline}</h1>
    <div class="subline">${c.subline}</div>
  </div>
  <div class="section">
    <p>${c.greeting}</p>
    <p>${c.intro}</p>
    <div class="stitle">Before vs. After</div>
    <div class="compare">
      <div class="col before">
        <div class="col-label">${c.before_label}</div>
        ${c.befores.map(b => `<div class="col-item">${b}</div>`).join('')}
      </div>
      <div class="col after">
        <div class="col-label">${c.after_label}</div>
        ${c.afters.map(a => `<div class="col-item">${a}</div>`).join('')}
      </div>
    </div>
    <div class="stitle">${c.features_title}</div>
    <div class="feat-grid">
      ${c.features.map(f => `<div class="feat"><div class="feat-icon">${f.icon}</div><div class="feat-title">${f.title}</div><div class="feat-desc">${f.desc}</div></div>`).join('')}
    </div>
    <div class="sectors"><div class="sectors-text">${c.sectors}</div></div>
    <div class="cta-box">
      <div class="cta-title">${c.cta_title}</div>
      <div class="cta-sub">${c.cta_sub}</div>
      <a href="https://mymediaconnect.com" class="cta">${c.cta}</a>
      <div class="pills">${c.pills.map(p => `<span class="pill">${p}</span>`).join('')}</div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">${foot}</div>
  </div>
</div></body></html>`
}

function buildCompliance(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.compliance[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:600px;margin:0 auto;background:white}
.header{background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:36px 40px}
.badge{display:inline-block;background:rgba(99,102,241,.2);color:#a5b4fc;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:18px;border:1px solid rgba(99,102,241,.3)}
h1{font-size:27px;font-weight:800;color:white;line-height:1.25;margin:0 0 10px}
.subline{font-size:14px;color:#94a3b8;line-height:1.6;margin:0}
.content{padding:36px 40px}
p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
.questions{background:#fef9ec;border:1px solid #fde68a;border-radius:12px;padding:18px 24px;margin-bottom:22px}
.q{color:#92400e;font-size:14px;line-height:1.6;padding:4px 0 4px 18px;position:relative}
.q:before{content:"?";position:absolute;left:0;color:#f59e0b;font-weight:700}
.sol-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin:20px 0 14px}
.sol{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #f1f5f9}
.sol:last-child{border-bottom:none;margin-bottom:0}
.sol-icon{font-size:20px;min-width:36px;height:36px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center}
.sol-h{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:3px}
.sol-d{font-size:13px;color:#64748b;line-height:1.5}
.cta-box{background:linear-gradient(135deg,#1e3a5f,#0f172a);border-radius:14px;padding:26px 32px;text-align:center;margin:24px 0}
.cta{display:inline-block;background:#6366f1;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
.cta-note{color:#94a3b8;font-size:12px;margin-top:10px}
.footer{padding:20px 40px;background:#f8fafc;text-align:center}
.footer-text{color:#9ca3af;font-size:12px;line-height:1.6}.footer a{color:#9ca3af}
</style></head><body><div class="wrap">
  <div class="header">${MMC_LOGO}<div style="margin-top:22px"><div class="badge">${c.badge}</div><h1>${c.headline}</h1><p class="subline">${c.subline}</p></div></div>
  <div class="content">
    <p>${c.greeting}</p><p>${c.intro}</p>
    <div class="questions">${c.questions.map(q => `<div class="q">${q}</div>`).join('')}</div>
    <p>${c.midtext}</p>
    <div class="sol-title">${c.solution_title}</div>
    ${c.solutions.map(s => `<div class="sol"><div class="sol-icon">${s.icon}</div><div><div class="sol-h">${s.title}</div><div class="sol-d">${s.desc}</div></div></div>`).join('')}
    <div class="cta-box"><a href="https://mymediaconnect.com" class="cta">${c.cta}</a><div class="cta-note">${c.cta_note}</div></div>
  </div>
  <div class="footer"><div class="footer-text">${foot}</div></div>
</div></body></html>`
}

function buildSectors(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.sectors[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:600px;margin:0 auto;background:white}
.header{background:linear-gradient(160deg,#0f172a,#1e293b);padding:32px 40px}
.badge{display:inline-block;background:rgba(16,185,129,.15);color:#34d399;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:18px;border:1px solid rgba(16,185,129,.25)}
h1{font-size:26px;font-weight:800;color:white;line-height:1.25;margin:0 0 10px}
.subline{font-size:14px;color:#94a3b8;line-height:1.6;margin:0}
.content{padding:32px 40px}
p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
.sector{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:12px;display:flex;gap:14px;align-items:flex-start}
.s-icon{font-size:22px;min-width:36px}
.s-name{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:4px}
.s-pain{font-size:13px;color:#64748b;line-height:1.5}
.metrics{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}
.metric{flex:1;min-width:120px;background:#0f172a;border-radius:10px;padding:14px;text-align:center}
.mnum{font-size:22px;font-weight:800;color:#34d399}
.mlabel{font-size:11px;color:#94a3b8;margin-top:3px}
.cta-box{text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:26px;margin-top:20px}
.cta{display:inline-block;background:#10b981;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
.cta-note{color:#059669;font-size:12px;margin-top:10px}
.footer{padding:20px 40px;background:#f8fafc;text-align:center}
.footer-text{color:#9ca3af;font-size:12px;line-height:1.6}.footer a{color:#9ca3af}
</style></head><body><div class="wrap">
  <div class="header">${MMC_LOGO}<div style="margin-top:22px"><div class="badge">${c.badge}</div><h1>${c.headline}</h1><p class="subline">${c.subline}</p></div></div>
  <div class="content">
    <p>${c.greeting}</p><p>${c.intro}</p>
    ${c.sectors_data.map(s => `<div class="sector"><div class="s-icon">${s.icon}</div><div><div class="s-name">${s.name}</div><div class="s-pain">${s.pain}</div></div></div>`).join('')}
    <p>${c.midtext}</p>
    <div class="metrics">${c.metrics.map(m => `<div class="metric"><div class="mnum">${m.split(' ')[0]}</div><div class="mlabel">${m.split(' ').slice(1).join(' ')}</div></div>`).join('')}</div>
    <div class="cta-box"><a href="https://mymediaconnect.com" class="cta">${c.cta}</a><div class="cta-note">${c.cta_note}</div></div>
  </div>
  <div class="footer"><div class="footer-text">${foot}</div></div>
</div></body></html>`
}

function buildDigital(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.digital[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:600px;margin:0 auto;background:white}
.header{background:#0f172a;padding:32px 40px;border-bottom:3px solid #3b82f6}
.badge{display:inline-block;background:rgba(59,130,246,.15);color:#60a5fa;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:18px;border:1px solid rgba(59,130,246,.25)}
h1{font-size:26px;font-weight:800;color:white;line-height:1.25;margin:0 0 10px}
.subline{font-size:14px;color:#94a3b8;line-height:1.6;margin:0}
.content{padding:32px 40px}
p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
.gap-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:18px 0 12px}
.gap-row{display:flex;gap:10px;margin-bottom:8px;align-items:stretch}
.gap-before{flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:13px;color:#991b1b}
.gap-arrow{display:flex;align-items:center;color:#cbd5e1;font-size:16px;padding:0 4px}
.gap-after{flex:1;background:#fef9ec;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:13px;color:#92400e}
.solution-box{background:#f0f9ff;border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:16px 20px;margin:20px 0}
.solution-text{color:#1e40af;font-size:15px;line-height:1.6}
.integrations{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.int-tag{background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600}
.cta-box{background:#1e293b;border-radius:14px;padding:26px;text-align:center;margin-top:24px}
.cta{display:inline-block;background:#3b82f6;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
.cta-note{color:#64748b;font-size:12px;margin-top:10px}
.footer{padding:20px 40px;background:#f8fafc;text-align:center}
.footer-text{color:#9ca3af;font-size:12px;line-height:1.6}.footer a{color:#9ca3af}
</style></head><body><div class="wrap">
  <div class="header">${MMC_LOGO}<div style="margin-top:22px"><div class="badge">${c.badge}</div><h1>${c.headline}</h1><p class="subline">${c.subline}</p></div></div>
  <div class="content">
    <p>${c.greeting}</p><p>${c.p1}</p><p>${c.p2}</p>
    <div class="gap-title">${c.gap_title}</div>
    ${c.gap_items.map(g => `<div class="gap-row"><div class="gap-before">✓ ${g.before}</div><div class="gap-arrow">→</div><div class="gap-after">✗ ${g.after}</div></div>`).join('')}
    <div class="solution-box"><div class="solution-text">${c.solution}</div></div>
    <div class="integrations">${c.integrations.map(i => `<span class="int-tag">${i}</span>`).join('')}</div>
    <div class="cta-box"><a href="https://mymediaconnect.com" class="cta">${c.cta}</a><div class="cta-note">${c.cta_note}</div></div>
  </div>
  <div class="footer"><div class="footer-text">${foot}</div></div>
</div></body></html>`
}

function buildTeam(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.team[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:600px;margin:0 auto;background:white}
.header{background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px}
.badge{display:inline-block;background:rgba(255,255,255,.15);color:white;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:18px}
h1{font-size:26px;font-weight:800;color:white;line-height:1.25;margin:0 0 10px}
.subline{font-size:14px;color:rgba(255,255,255,.7);line-height:1.6;margin:0}
.content{padding:32px 40px}
p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
.pain{background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:10px;font-size:14px;color:#7f1d1d;font-style:italic}
.sol-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:22px 0 14px}
.feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px}
.feat{background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:16px}
.feat-icon{font-size:20px;margin-bottom:7px}
.feat-title{font-size:13px;font-weight:700;color:#581c87;margin-bottom:3px}
.feat-desc{font-size:12px;color:#6b21a8;line-height:1.45}
.cta-box{text-align:center;margin-top:20px}
.cta{display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;padding:14px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px}
.cta-note{color:#64748b;font-size:12px;margin-top:10px}
.footer{padding:20px 40px;background:#f8fafc;text-align:center}
.footer-text{color:#9ca3af;font-size:12px;line-height:1.6}.footer a{color:#9ca3af}
</style></head><body><div class="wrap">
  <div class="header">${MMC_LOGO}<div style="margin-top:22px"><div class="badge">${c.badge}</div><h1>${c.headline}</h1><p class="subline">${c.subline}</p></div></div>
  <div class="content">
    <p>${c.greeting}</p><p>${c.intro}</p>
    ${c.pains.map(p => `<div class="pain">${p}</div>`).join('')}
    <div class="sol-title">${c.solution_title}</div>
    <div class="feat-grid">${c.features.map(f => `<div class="feat"><div class="feat-icon">${f.icon}</div><div class="feat-title">${f.title}</div><div class="feat-desc">${f.desc}</div></div>`).join('')}</div>
    <div class="cta-box"><a href="https://mymediaconnect.com" class="cta">${c.cta}</a><div class="cta-note">${c.cta_note}</div></div>
  </div>
  <div class="footer"><div class="footer-text">${foot}</div></div>
</div></body></html>`
}

function buildCEO(lang: Lang, unsub = '{{UNSUBSCRIBE_URL}}'): string {
  const c = T.ceo[lang]
  const foot = T.footer[lang](unsub)
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
body{margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:600px;margin:0 auto;background:white}
.header{background:linear-gradient(160deg,#0c1a2e,#1e293b);padding:36px 40px}
.badge{display:inline-block;background:rgba(251,191,36,.15);color:#fbbf24;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:18px;border:1px solid rgba(251,191,36,.3)}
h1{font-size:27px;font-weight:800;color:white;line-height:1.25;margin:0 0 10px}
.subline{font-size:14px;color:#94a3b8;line-height:1.6;margin:0}
.content{padding:36px 40px}
p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
.kpi-num{font-size:28px;font-weight:900;color:#0f172a;letter-spacing:-1px}
.kpi-label{font-size:13px;font-weight:600;color:#1e293b;margin:3px 0}
.kpi-context{font-size:12px;color:#64748b;line-height:1.4}
.quote{background:#0f172a;border-radius:14px;padding:22px 26px;margin:20px 0}
.quote-text{color:#e2e8f0;font-size:15px;font-style:italic;line-height:1.6;margin:0 0 10px}
.quote-role{color:#475569;font-size:12px}
.cta-box{background:#fbbf24;border-radius:14px;padding:26px;text-align:center;margin-top:20px}
.cta{display:inline-block;background:#0f172a;color:white;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:800;font-size:15px}
.cta-note{color:#92400e;font-size:12px;margin-top:10px}
.footer{padding:20px 40px;background:#f8fafc;text-align:center}
.footer-text{color:#9ca3af;font-size:12px;line-height:1.6}.footer a{color:#9ca3af}
</style></head><body><div class="wrap">
  <div class="header">${MMC_LOGO}<div style="margin-top:22px"><div class="badge">${c.badge}</div><h1>${c.headline}</h1><p class="subline">${c.subline}</p></div></div>
  <div class="content">
    <p>${c.greeting}</p><p>${c.intro}</p>
    <div class="kpis">${c.kpis.map(k => `<div class="kpi"><div class="kpi-num">${k.num}</div><div class="kpi-label">${k.label}</div><div class="kpi-context">${k.context}</div></div>`).join('')}</div>
    <div class="quote"><div class="quote-text">${c.quote}</div><div class="quote-role">${c.quote_role}</div></div>
    <p>${c.close}</p>
    <div class="cta-box"><a href="https://mymediaconnect.com" class="cta">${c.cta}</a><div class="cta-note">${c.cta_note}</div></div>
  </div>
  <div class="footer"><div class="footer-text">${foot}</div></div>
</div></body></html>`
}

// ─────────────────────────────────────────────────────────────
// EXPORT — tipos e interfaz pública
// ─────────────────────────────────────────────────────────────

export interface PresetTemplate {
  id: string
  name: string
  subject: string
  description: string
  body_html: string
  tag: string
}

// Sujetos por idioma
const SUBJECTS: Record<string, Record<Lang, string>> = {
  loop: {
    es: '¿Cuántas versiones del mismo packaging lleváis ya?',
    en: 'How many versions of the same packaging do you already have?',
    fr: 'Combien de versions du même packaging avez-vous déjà ?',
  },
  roi: {
    es: 'Tu empresa pierde dinero aprobando packaging (y no lo has medido)',
    en: 'Your company is losing money approving packaging (and you haven\'t measured it)',
    fr: 'Votre entreprise perd de l\'argent à valider des packagings (sans l\'avoir mesuré)',
  },
  future: {
    es: 'Las marcas que ganan ya no aprueban packaging en email',
    en: 'Winning brands no longer approve packaging by email',
    fr: 'Les marques qui gagnent ne valident plus leurs packagings par email',
  },
  direct: {
    es: '¿Cuál es vuestro mayor dolor con el packaging? (pregunta directa)',
    en: 'What\'s your biggest pain with packaging approvals? (direct question)',
    fr: 'Quel est votre plus grand point de douleur avec les validations packaging ?',
  },
  showcase: {
    es: 'De 8 días a 3: así cambia MyMediaConnect el proceso de packaging',
    en: 'From 8 days to 3: how MyMediaConnect changes the packaging process',
    fr: 'De 8 jours à 3 : comment MyMediaConnect transforme le processus packaging',
  },
  compliance: {
    es: '¿Puedes demostrar quién aprobó cada packaging y cuándo?',
    en: 'Can you prove who approved each packaging and when?',
    fr: 'Pouvez-vous prouver qui a validé chaque packaging et quand ?',
  },
  sectors: {
    es: 'Los equipos de packaging más ágiles de tu sector ya usan MyMediaConnect',
    en: 'The most agile packaging teams in your sector already use MyMediaConnect',
    fr: 'Les équipes packaging les plus agiles de votre secteur utilisent déjà MyMediaConnect',
  },
  digital: {
    es: 'Tu ERP está digitalizado. Tu packaging sigue en email.',
    en: 'Your ERP is digitalised. Your packaging is still in email.',
    fr: 'Votre ERP est digitalisé. Votre packaging passe encore par email.',
  },
  team: {
    es: 'Tu equipo de packaging trabaja en silos. El packaging lo paga.',
    en: 'Your packaging team works in silos. The packaging pays for it.',
    fr: 'Votre équipe packaging travaille en silos. Le packaging en fait les frais.',
  },
  ceo: {
    es: '¿Cuánto os está costando realmente la gestión del packaging?',
    en: 'What is packaging management really costing you?',
    fr: 'Combien vous coûte vraiment la gestion du packaging ?',
  },
}

const NAMES: Record<string, Record<Lang, string>> = {
  loop:       { es: 'El loop infinito',       en: 'The infinite loop',      fr: 'La boucle infinie' },
  roi:        { es: 'El coste oculto',        en: 'The hidden cost',        fr: 'Le coût caché' },
  future:     { es: 'El futuro ya está aquí', en: 'The future is here',     fr: 'Le futur est là' },
  direct:     { es: 'Pregunta directa',       en: 'Direct question',        fr: 'Question directe' },
  showcase:   { es: 'Antes vs. Después',      en: 'Before vs. After',       fr: 'Avant vs. Après' },
  compliance: { es: 'Compliance & Auditoría', en: 'Compliance & Audit',     fr: 'Conformité & Audit' },
  sectors:    { es: 'Por sector',             en: 'By sector',              fr: 'Par secteur' },
  digital:    { es: 'Transformación digital', en: 'Digital transformation', fr: 'Transformation digitale' },
  team:       { es: 'Trabajo en equipo',      en: 'Teamwork',               fr: 'Travail d\'équipe' },
  ceo:        { es: 'Visión C-Level',         en: 'C-Level vision',         fr: 'Vision C-Level' },
}

const DESCS: Record<string, Record<Lang, string>> = {
  loop:       { es: 'Pain point — ciclos de aprobación de packaging', en: 'Pain point — packaging approval cycles', fr: 'Pain point — cycles de validation packaging' },
  roi:        { es: 'ROI — métricas reales (-45% TTM, -85% iteraciones, -75% errores)', en: 'ROI — real metrics (-45% TTM, -85% iterations, -75% errors)', fr: 'ROI — métriques réelles (-45% TTM, -85% itérations, -75% erreurs)' },
  future:     { es: 'Aspiracional — posicionamiento tech y módulos de la plataforma', en: 'Aspirational — tech positioning and platform modules', fr: 'Aspirationnel — positionnement tech et modules de la plateforme' },
  direct:     { es: 'Conversacional — 5 pain points clicables, ideal como follow-up', en: 'Conversational — 5 clickable pain points, ideal as follow-up', fr: 'Conversationnel — 5 points de douleur cliquables, idéal en suivi' },
  showcase:   { es: 'Showcase — 4 módulos, Antes/Después, sectores objetivo', en: 'Showcase — 4 modules, Before/After, target sectors', fr: 'Showcase — 4 modules, Avant/Après, secteurs cibles' },
  compliance: { es: 'Compliance — audit trail, trazabilidad, sectores regulados', en: 'Compliance — audit trail, traceability, regulated sectors', fr: 'Conformité — audit trail, traçabilité, secteurs réglementés' },
  sectors:    { es: 'Sectores — FMCG, Pharma, Cosmética, Retail con métricas', en: 'Sectors — FMCG, Pharma, Cosmetics, Retail with metrics', fr: 'Secteurs — FMCG, Pharma, Cosmétique, Retail avec métriques' },
  digital:    { es: 'Digital — la brecha entre ERP/DAM y aprobación de packaging', en: 'Digital — the gap between ERP/DAM and packaging approval', fr: 'Digital — le fossé entre ERP/DAM et validation packaging' },
  team:       { es: 'Equipo — coordinación interna y externa, silos organizativos', en: 'Team — internal and external coordination, organisational silos', fr: "Équipe — coordination interne et externe, silos organisationnels" },
  ceo:        { es: 'C-Level — ROI ejecutivo, visibilidad estratégica, KPIs', en: 'C-Level — executive ROI, strategic visibility, KPIs', fr: 'C-Level — ROI exécutif, visibilité stratégique, KPIs' },
}

/**
 * Genera las 10 plantillas en el idioma indicado.
 * @param lang 'es' | 'en' | 'fr'
 */
export function getPresetTemplates(lang: Lang): PresetTemplate[] {
  return [
    { id: `preset-loop-${lang}`,       name: NAMES.loop[lang],       subject: SUBJECTS.loop[lang],       description: DESCS.loop[lang],       body_html: buildLoop(lang),       tag: 'pain' },
    { id: `preset-roi-${lang}`,        name: NAMES.roi[lang],        subject: SUBJECTS.roi[lang],        description: DESCS.roi[lang],        body_html: buildROI(lang),        tag: 'roi' },
    { id: `preset-future-${lang}`,     name: NAMES.future[lang],     subject: SUBJECTS.future[lang],     description: DESCS.future[lang],     body_html: buildFuture(lang),     tag: 'tech' },
    { id: `preset-direct-${lang}`,     name: NAMES.direct[lang],     subject: SUBJECTS.direct[lang],     description: DESCS.direct[lang],     body_html: buildDirect(lang),     tag: 'direct' },
    { id: `preset-showcase-${lang}`,   name: NAMES.showcase[lang],   subject: SUBJECTS.showcase[lang],   description: DESCS.showcase[lang],   body_html: buildShowcase(lang),   tag: 'showcase' },
    { id: `preset-compliance-${lang}`, name: NAMES.compliance[lang], subject: SUBJECTS.compliance[lang], description: DESCS.compliance[lang], body_html: buildCompliance(lang), tag: 'compliance' },
    { id: `preset-sectors-${lang}`,    name: NAMES.sectors[lang],    subject: SUBJECTS.sectors[lang],    description: DESCS.sectors[lang],    body_html: buildSectors(lang),    tag: 'sectors' },
    { id: `preset-digital-${lang}`,    name: NAMES.digital[lang],    subject: SUBJECTS.digital[lang],    description: DESCS.digital[lang],    body_html: buildDigital(lang),    tag: 'digital' },
    { id: `preset-team-${lang}`,       name: NAMES.team[lang],       subject: SUBJECTS.team[lang],       description: DESCS.team[lang],       body_html: buildTeam(lang),       tag: 'team' },
    { id: `preset-ceo-${lang}`,        name: NAMES.ceo[lang],        subject: SUBJECTS.ceo[lang],        description: DESCS.ceo[lang],        body_html: buildCEO(lang),        tag: 'ceo' },
  ]
}

// Default ES — retrocompatibilidad
export const PRESET_TEMPLATES = getPresetTemplates('es')

export const TAG_STYLES: Record<string, string> = {
  pain:       'bg-red-50 text-red-600 border-red-200',
  roi:        'bg-amber-50 text-amber-600 border-amber-200',
  tech:       'bg-purple-50 text-purple-600 border-purple-200',
  direct:     'bg-blue-50 text-blue-600 border-blue-200',
  showcase:   'bg-green-50 text-green-600 border-green-200',
  compliance: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  sectors:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  digital:    'bg-cyan-50 text-cyan-600 border-cyan-200',
  team:       'bg-violet-50 text-violet-600 border-violet-200',
  ceo:        'bg-yellow-50 text-yellow-700 border-yellow-200',
}

export const TAG_LABELS: Record<string, string> = {
  pain:       'Pain point',
  roi:        'ROI',
  tech:       'Tech',
  direct:     'Directo',
  showcase:   'Showcase',
  compliance: 'Compliance',
  sectors:    'Sectores',
  digital:    'Digital',
  team:       'Equipo',
  ceo:        'C-Level',
}

export const LANG_LABELS: Record<Lang, string> = {
  es: '🇪🇸 ES',
  en: '🇬🇧 EN',
  fr: '🇫🇷 FR',
}
