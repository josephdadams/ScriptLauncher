// src/store.ts
// Single, centrally-configured electron-store instance so that defaults
// (notably the password) are consistent everywhere in the app.
import Store from 'electron-store'
import { defaultSettings } from './defaults.js'

export const store = new Store({ defaults: defaultSettings })
