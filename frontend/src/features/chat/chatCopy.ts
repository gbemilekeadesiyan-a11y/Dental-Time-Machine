/**
 * On-screen text for the chat feature, in the four supported languages.
 * Wording only: no dollar amounts here, ever (CLAUDE.md section 2).
 */

import type { Language, Style } from '../../types'

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
  micProblem: string
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
    micProblem: "We couldn't use the microphone. You can type instead.",
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
    micProblem: 'No pudimos usar el micrófono. Puedes escribir.',
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
    micProblem: "Impossible d'utiliser le micro. Vous pouvez écrire.",
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
    micProblem: 'Não foi possível usar o microfone. Você pode digitar.',
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
    summaryTitle: 'Seu resumo',
    summaryWorking: 'Escrevendo seu resumo…',
    summaryNeedsCare: 'Adicione seu tratamento e os dados do seu plano para ver um resumo.',
    readAloud: 'Ler em voz alta',
    stopAudio: 'Parar',
    voiceProblem: 'A voz não está disponível agora. O texto continua aqui.',
  },
}
