/**
 * On-screen text for the chat feature, in the four supported languages.
 * Wording only: no dollar amounts here, ever (CLAUDE.md section 2).
 */

import type { Language, Style } from '../../types'
import type { MicProblem } from './speech'

export interface ChatCopy {
  languageLabel: string
  styleLabel: string
  styles: Record<Style, string>
  voiceLabel: string
  intakeTitle: string
  intakeIntro: string
  you: string
  assistant: string
  messageLabel: string
  messagePlaceholder: string
  send: string
  thinking: string
  talk: string
  stopTalking: string
  listening: string
  micProblems: Record<MicProblem, string>
  proposalsTitle: string
  proposalsHelp: string
  feeLabel: string
  toothLabel: string
  remove: string
  addToCare: string
  notNow: string
  feeProblem: string
  canWaitYes: (name: string) => string
  canWaitNo: string
  zipQuestion: (zip: string) => string
  zipUse: string
  zipSkip: string
  comesAfter: (name: string) => string
  planTitle: string
  planHelp: string
  applyPlan: string
  planFields: {
    annual_max: string
    deductible: string
    preventive: string
    basic: string
    major: string
    reset_date: string
    used_this_year: string
    deductible_paid_this_year: string
    in_network: string
  }
  inNetwork: string
  outOfNetwork: string
  summaryTitle: string
  summaryWorking: string
  summaryNeedsCare: string
  readAloud: string
  stopAudio: string
  voiceProblem: string
}

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
}

/** Locale for the browser's speech recognition. */
export const SPEECH_LOCALES: Record<Language, string> = {
  en: 'en-US',
  es: 'es-US',
  fr: 'fr-FR',
  pt: 'pt-BR',
}

export const CHAT_COPY: Record<Language, ChatCopy> = {
  en: {
    languageLabel: 'Language',
    styleLabel: 'Style',
    styles: { simple: 'Simple', detailed: 'Detailed', numbers: 'Just the numbers' },
    voiceLabel: 'Read answers aloud',
    intakeTitle: 'Tell us in your own words',
    intakeIntro: 'Describe what your dentist recommended. Type, or tap the microphone to talk.',
    you: 'You',
    assistant: 'Assistant',
    messageLabel: 'Your message',
    messagePlaceholder: 'For example: my dentist said I need a root canal and two crowns',
    send: 'Send',
    thinking: 'Thinking…',
    talk: 'Talk',
    stopTalking: 'Stop',
    listening: 'Listening… tap Stop when you are done.',
    micProblems: {
      denied:
        'Microphone access is blocked. Click the lock icon next to the address bar, allow the microphone, and reload. You can type instead.',
      service:
        "This browser couldn't reach its speech service. Try Chrome or Edge, and check your connection. You can type instead.",
      no_mic: 'No microphone was found, or another app is using it. You can type instead.',
      other: "We couldn't use the microphone. You can type instead.",
    },
    proposalsTitle: 'We heard these procedures',
    proposalsHelp: 'Check the details. Nothing is added until you confirm.',
    feeLabel: "Dentist's fee",
    toothLabel: 'Tooth (optional)',
    remove: 'Remove',
    addToCare: 'Add to my care',
    notNow: 'Not now',
    feeProblem: 'Each fee must be between 0 and 50,000, and each tooth between 1 and 32.',
    canWaitYes: (name) => `Yes, my dentist said ${name} can wait`,
    canWaitNo: 'Keep it locked',
    zipQuestion: (zip) => `Use ZIP ${zip} to find dentists nearby? Closer ones are listed first.`,
    zipUse: 'Use it',
    zipSkip: 'No thanks',
    comesAfter: (name) => `Comes after the ${name.toLowerCase()}`,
    planTitle: 'We heard these plan details',
    planHelp: 'Check them. They fill in the plan form only when you apply them.',
    applyPlan: 'Apply to my plan',
    planFields: {
      annual_max: 'Annual maximum',
      deductible: 'Deductible',
      preventive: 'Preventive coverage',
      basic: 'Basic coverage',
      major: 'Major coverage',
      reset_date: 'Plan year resets on',
      used_this_year: 'Benefits used so far this year',
      deductible_paid_this_year: 'Deductible paid so far this year',
      in_network: 'Network',
    },
    inNetwork: 'In network',
    outOfNetwork: 'Out of network',
    summaryTitle: 'Your summary',
    summaryWorking: 'Writing your summary…',
    summaryNeedsCare: 'Add your care and plan details to see a summary.',
    readAloud: 'Read aloud',
    stopAudio: 'Stop',
    voiceProblem: "Voice isn't available right now. The text is still here.",
  },
  es: {
    languageLabel: 'Idioma',
    styleLabel: 'Estilo',
    styles: { simple: 'Sencillo', detailed: 'Detallado', numbers: 'Solo los números' },
    voiceLabel: 'Leer respuestas en voz alta',
    intakeTitle: 'Cuéntanos con tus propias palabras',
    intakeIntro: 'Describe lo que te recomendó tu dentista. Escribe o toca el micrófono para hablar.',
    you: 'Tú',
    assistant: 'Asistente',
    messageLabel: 'Tu mensaje',
    messagePlaceholder: 'Por ejemplo: mi dentista dijo que necesito una endodoncia y dos coronas',
    send: 'Enviar',
    thinking: 'Pensando…',
    talk: 'Hablar',
    stopTalking: 'Detener',
    listening: 'Escuchando… toca Detener cuando termines.',
    micProblems: {
      denied:
        'El acceso al micrófono está bloqueado. Haz clic en el candado junto a la barra de direcciones, permite el micrófono y recarga. También puedes escribir.',
      service:
        'Este navegador no pudo conectarse a su servicio de voz. Prueba Chrome o Edge y revisa tu conexión. También puedes escribir.',
      no_mic: 'No se encontró un micrófono, o otra aplicación lo está usando. También puedes escribir.',
      other: 'No pudimos usar el micrófono. Puedes escribir.',
    },
    proposalsTitle: 'Entendimos estos procedimientos',
    proposalsHelp: 'Revisa los datos. No se agrega nada hasta que confirmes.',
    feeLabel: 'Tarifa del dentista',
    toothLabel: 'Diente (opcional)',
    remove: 'Quitar',
    addToCare: 'Agregar a mi atención',
    notNow: 'Ahora no',
    feeProblem: 'Cada tarifa debe estar entre 0 y 50.000, y cada diente entre 1 y 32.',
    canWaitYes: (name) => `Sí, mi dentista dijo que ${name} puede esperar`,
    canWaitNo: 'Mantener bloqueado',
    zipQuestion: (zip) => `¿Usar el código postal ${zip} para buscar dentistas cercanos? Los más cercanos aparecen primero.`,
    zipUse: 'Usarlo',
    zipSkip: 'No, gracias',
    comesAfter: (name) => `Va después de: ${name}`,
    planTitle: 'Entendimos estos datos de tu plan',
    planHelp: 'Revísalos. Solo llenan el formulario del plan cuando los aplicas.',
    applyPlan: 'Aplicar a mi plan',
    planFields: {
      annual_max: 'Máximo anual',
      deductible: 'Deducible',
      preventive: 'Cobertura preventiva',
      basic: 'Cobertura básica',
      major: 'Cobertura mayor',
      reset_date: 'El año del plan se reinicia el',
      used_this_year: 'Beneficios usados este año',
      deductible_paid_this_year: 'Deducible pagado este año',
      in_network: 'Red',
    },
    inNetwork: 'Dentro de la red',
    outOfNetwork: 'Fuera de la red',
    summaryTitle: 'Tu resumen',
    summaryWorking: 'Escribiendo tu resumen…',
    summaryNeedsCare: 'Agrega tu atención y los datos de tu plan para ver un resumen.',
    readAloud: 'Leer en voz alta',
    stopAudio: 'Detener',
    voiceProblem: 'La voz no está disponible ahora. El texto sigue aquí.',
  },
  fr: {
    languageLabel: 'Langue',
    styleLabel: 'Style',
    styles: { simple: 'Simple', detailed: 'Détaillé', numbers: 'Juste les chiffres' },
    voiceLabel: 'Lire les réponses à voix haute',
    intakeTitle: 'Dites-le avec vos mots',
    intakeIntro: 'Décrivez ce que votre dentiste a recommandé. Écrivez, ou touchez le micro pour parler.',
    you: 'Vous',
    assistant: 'Assistant',
    messageLabel: 'Votre message',
    messagePlaceholder: "Par exemple : mon dentiste dit que j'ai besoin d'un traitement de canal et de deux couronnes",
    send: 'Envoyer',
    thinking: 'Réflexion…',
    talk: 'Parler',
    stopTalking: 'Arrêter',
    listening: 'Écoute… touchez Arrêter quand vous avez fini.',
    micProblems: {
      denied:
        "L'accès au micro est bloqué. Cliquez sur le cadenas à côté de la barre d'adresse, autorisez le micro et rechargez. Vous pouvez aussi écrire.",
      service:
        "Ce navigateur n'a pas pu joindre son service vocal. Essayez Chrome ou Edge et vérifiez votre connexion. Vous pouvez aussi écrire.",
      no_mic: "Aucun micro trouvé, ou une autre application l'utilise. Vous pouvez aussi écrire.",
      other: "Impossible d'utiliser le micro. Vous pouvez écrire.",
    },
    proposalsTitle: 'Nous avons compris ces soins',
    proposalsHelp: "Vérifiez les détails. Rien n'est ajouté avant votre confirmation.",
    feeLabel: 'Tarif du dentiste',
    toothLabel: 'Dent (facultatif)',
    remove: 'Retirer',
    addToCare: 'Ajouter à mes soins',
    notNow: 'Pas maintenant',
    feeProblem: 'Chaque tarif doit être entre 0 et 50 000, et chaque dent entre 1 et 32.',
    canWaitYes: (name) => `Oui, mon dentiste a dit que ${name} peut attendre`,
    canWaitNo: 'Garder verrouillé',
    zipQuestion: (zip) => `Utiliser le code postal ${zip} pour trouver des dentistes proches ? Les plus proches sont affichés en premier.`,
    zipUse: 'Utiliser',
    zipSkip: 'Non merci',
    comesAfter: (name) => `Vient après : ${name}`,
    planTitle: 'Nous avons compris ces détails de votre régime',
    planHelp: "Vérifiez-les. Ils remplissent le formulaire du régime seulement quand vous les appliquez.",
    applyPlan: 'Appliquer à mon régime',
    planFields: {
      annual_max: 'Maximum annuel',
      deductible: 'Franchise',
      preventive: 'Couverture préventive',
      basic: 'Couverture de base',
      major: 'Couverture majeure',
      reset_date: "L'année du régime recommence le",
      used_this_year: 'Prestations utilisées cette année',
      deductible_paid_this_year: 'Franchise payée cette année',
      in_network: 'Réseau',
    },
    inNetwork: 'Dans le réseau',
    outOfNetwork: 'Hors réseau',
    summaryTitle: 'Votre résumé',
    summaryWorking: 'Rédaction de votre résumé…',
    summaryNeedsCare: 'Ajoutez vos soins et les détails de votre régime pour voir un résumé.',
    readAloud: 'Lire à voix haute',
    stopAudio: 'Arrêter',
    voiceProblem: "La voix n'est pas disponible pour le moment. Le texte reste affiché.",
  },
  pt: {
    languageLabel: 'Idioma',
    styleLabel: 'Estilo',
    styles: { simple: 'Simples', detailed: 'Detalhado', numbers: 'Só os números' },
    voiceLabel: 'Ler respostas em voz alta',
    intakeTitle: 'Conte com suas próprias palavras',
    intakeIntro: 'Descreva o que seu dentista recomendou. Digite ou toque no microfone para falar.',
    you: 'Você',
    assistant: 'Assistente',
    messageLabel: 'Sua mensagem',
    messagePlaceholder: 'Por exemplo: meu dentista disse que preciso de um tratamento de canal e duas coroas',
    send: 'Enviar',
    thinking: 'Pensando…',
    talk: 'Falar',
    stopTalking: 'Parar',
    listening: 'Ouvindo… toque em Parar quando terminar.',
    micProblems: {
      denied:
        'O acesso ao microfone está bloqueado. Clique no cadeado ao lado da barra de endereço, permita o microfone e recarregue. Você também pode digitar.',
      service:
        'Este navegador não conseguiu acessar o serviço de voz. Tente o Chrome ou o Edge e verifique sua conexão. Você também pode digitar.',
      no_mic: 'Nenhum microfone encontrado, ou outro aplicativo está usando. Você também pode digitar.',
      other: 'Não foi possível usar o microfone. Você pode digitar.',
    },
    proposalsTitle: 'Entendemos estes procedimentos',
    proposalsHelp: 'Confira os dados. Nada é adicionado até você confirmar.',
    feeLabel: 'Valor do dentista',
    toothLabel: 'Dente (opcional)',
    remove: 'Remover',
    addToCare: 'Adicionar ao meu tratamento',
    notNow: 'Agora não',
    feeProblem: 'Cada valor deve estar entre 0 e 50.000, e cada dente entre 1 e 32.',
    canWaitYes: (name) => `Sim, meu dentista disse que ${name} pode esperar`,
    canWaitNo: 'Manter bloqueado',
    zipQuestion: (zip) => `Usar o código postal ${zip} para encontrar dentistas próximos? Os mais próximos aparecem primeiro.`,
    zipUse: 'Usar',
    zipSkip: 'Não, obrigado',
    comesAfter: (name) => `Vem depois de: ${name}`,
    planTitle: 'Entendemos estes dados do seu plano',
    planHelp: 'Confira. Eles só preenchem o formulário do plano quando você os aplica.',
    applyPlan: 'Aplicar ao meu plano',
    planFields: {
      annual_max: 'Máximo anual',
      deductible: 'Franquia',
      preventive: 'Cobertura preventiva',
      basic: 'Cobertura básica',
      major: 'Cobertura maior',
      reset_date: 'O ano do plano reinicia em',
      used_this_year: 'Benefícios usados este ano',
      deductible_paid_this_year: 'Franquia paga este ano',
      in_network: 'Rede',
    },
    inNetwork: 'Na rede',
    outOfNetwork: 'Fora da rede',
    summaryTitle: 'Seu resumo',
    summaryWorking: 'Escrevendo seu resumo…',
    summaryNeedsCare: 'Adicione seu tratamento e os dados do seu plano para ver um resumo.',
    readAloud: 'Ler em voz alta',
    stopAudio: 'Parar',
    voiceProblem: 'A voz não está disponível agora. O texto continua aqui.',
  },
}
