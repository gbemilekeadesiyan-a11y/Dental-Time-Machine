/** On-screen labels for the guide's controls, in the four languages. No figures here. */

import type { Language } from '../../../types'

export interface GuideCopy {
  name: string
  pause: string
  play: string
  skip: string
  replay: string
  close: string
  open: string
  progress: (step: number, total: number) => string
}

export const GUIDE_COPY: Record<Language, GuideCopy> = {
  en: {
    name: 'Guide',
    pause: 'Pause the guide',
    play: 'Play the guide',
    skip: 'Skip to the next part',
    replay: 'Replay this step',
    close: 'Close the guide',
    open: 'Guide',
    progress: (step, total) => `Step ${step} of ${total}`,
  },
  es: {
    name: 'Guía',
    pause: 'Pausar la guía',
    play: 'Reproducir la guía',
    skip: 'Saltar a la siguiente parte',
    replay: 'Repetir este paso',
    close: 'Cerrar la guía',
    open: 'Guía',
    progress: (step, total) => `Paso ${step} de ${total}`,
  },
  fr: {
    name: 'Guide',
    pause: 'Mettre le guide en pause',
    play: 'Lire le guide',
    skip: 'Passer à la suite',
    replay: 'Rejouer cette étape',
    close: 'Fermer le guide',
    open: 'Guide',
    progress: (step, total) => `Étape ${step} sur ${total}`,
  },
  pt: {
    name: 'Guia',
    pause: 'Pausar o guia',
    play: 'Reproduzir o guia',
    skip: 'Pular para a próxima parte',
    replay: 'Repetir esta etapa',
    close: 'Fechar o guia',
    open: 'Guia',
    progress: (step, total) => `Etapa ${step} de ${total}`,
  },
}
