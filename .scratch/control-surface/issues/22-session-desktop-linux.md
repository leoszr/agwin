# 22: Operar a mesma Session no Desktop Linux

**What to build:** Entregar um AppImage que inicia ou encontra o host persistente e acompanha a mesma Session do Web sem duplicar sua execução.

**Blocked by:** 21/Operar uma Session Web pelo Client runtime

**Status:** resolved

- [x] O Desktop instala, inicia ou encontra o host versionado sem administração manual.
- [x] Web e Desktop observam e controlam a mesma Session e o mesmo transcript.
- [x] Fechar ou reiniciar o renderer não encerra o host nem o agente.
- [x] Renderer e popouts usam a mesma origem e os mesmos contratos HTTP/WS do Web.
- [x] Sandbox, context isolation, CSP e preload curado são verificados no artefato empacotado.
