import notifier from 'node-notifier';

const TITLE = 'Veille Techno';

/** Affiche une notification Windows de succès avec le nom du fichier publié. */
export function notifySuccess(filename: string): void {
  notifier.notify({ title: TITLE, message: `${filename} publié sur le wiki !`, sound: true, wait: false });
}

/** Affiche une notification Windows d'erreur avec le message tronqué. */
export function notifyError(error: Error): void {
  notifier.notify({ title: `${TITLE} — Erreur`, message: error.message.slice(0, 250), sound: true, wait: false });
}
