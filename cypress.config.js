const { defineConfig } = require('cypress');
const { DatabaseSync } = require('node:sqlite');
const { CAMINHO_BANCO } = require('./app/banco');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on) {
      on('task', {
        // Executa uma consulta SQL no banco da loja, em modo somente leitura, e devolve as linhas.
        consultarBanco({ sql, parametros = [] }) {
          const db = new DatabaseSync(CAMINHO_BANCO, { readOnly: true });
          try {
            return db.prepare(sql).all(...parametros).map((linha) => ({ ...linha }));
          } finally {
            db.close();
          }
        },
      });
    },
  },
});
