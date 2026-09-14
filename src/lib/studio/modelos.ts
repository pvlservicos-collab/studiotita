/**
 * MODELOS DE SEMANA PRONTOS DO ESTÚDIO.
 *
 * São as mesmas grades que o botão "modelos" do estúdio oferece (extraídas de
 * public/estudio-reels.html): as âncoras, a semana do empresário, a lotada, a
 * caótica, a equilibrada, a flexível, a mapeada dos alunos antes da mentoria.
 * O Augusto usa esses modelos como exemplo e como ANTI-exemplo nos vídeos.
 *
 * Quando o Gemini escolhe um modelo pelo nome (agenda.modelo), a grade entra
 * pronta, igual à do estúdio, em vez de blocos inventados.
 * Gerado a partir do estúdio; não edite à mão.
 */
import type { SceneAgendaBlock } from "@/lib/studio/scenes";

export interface ModeloSemana {
  nome: string;
  desc: string;
  blocos: SceneAgendaBlock[];
}

export const MODELOS_SEMANA: ModeloSemana[] = [
 {
  "nome": "Só o sono",
  "desc": "dorme 23h, acorda 7h, resto em branco",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   }
  ]
 },
 {
  "nome": "Balizadores",
  "desc": "só as âncoras: sono, e almoço e treino nos dias úteis",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 1,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 2,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 3,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 4,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   }
  ]
 },
 {
  "nome": "Semana do empresário",
  "desc": "trabalho longo, treino à noite, fim de semana vazio",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "18:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "18:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "18:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "18:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "18:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "08:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "09:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 0,
    "inicio": "10:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 0,
    "inicio": "13:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "14:30",
    "dur": 120,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "08:00",
    "dur": 120,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "10:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 1,
    "inicio": "11:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "13:30",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "15:00",
    "dur": 120,
    "cat": "vaz",
    "rot": "Botar lenha na fogueira"
   },
   {
    "dia": 1,
    "inicio": "17:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "08:00",
    "dur": 120,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 2,
    "inicio": "11:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 2,
    "inicio": "14:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Falar sobre o elefante na sala"
   },
   {
    "dia": 2,
    "inicio": "15:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Fazer tempestade em copo d'água"
   },
   {
    "dia": 2,
    "inicio": "16:00",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "09:00",
    "dur": 180,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "13:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 3,
    "inicio": "14:00",
    "dur": 90,
    "cat": "vaz",
    "rot": "Dar meus pitacos"
   },
   {
    "dia": 3,
    "inicio": "16:30",
    "dur": 90,
    "cat": "vaz",
    "rot": "Querer tudo ao mesmo tempo"
   },
   {
    "dia": 4,
    "inicio": "13:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Coringa"
   }
  ]
 },
 {
  "nome": "Semana lotada",
  "desc": "a crença do empresário: agenda boa é agenda cheia, um bloco atrás do outro",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 0,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 0,
    "inicio": "21:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 1,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 1,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 1,
    "inicio": "21:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 2,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 2,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 2,
    "inicio": "21:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 3,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 3,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 3,
    "inicio": "21:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 4,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 4,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 4,
    "inicio": "21:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Botar lenha na fogueira"
   },
   {
    "dia": 1,
    "inicio": "20:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Falar sobre o elefante na sala"
   },
   {
    "dia": 3,
    "inicio": "20:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 0,
    "inicio": "08:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 0,
    "inicio": "09:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Fazer tempestade em copo d'água"
   },
   {
    "dia": 0,
    "inicio": "10:00",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "13:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 0,
    "inicio": "14:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Dar meus pitacos"
   },
   {
    "dia": 0,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "16:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "08:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Querer tudo ao mesmo tempo"
   },
   {
    "dia": 1,
    "inicio": "09:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "10:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "11:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Tirar conclusões precipitadas"
   },
   {
    "dia": 1,
    "inicio": "13:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "14:30",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "15:30",
    "dur": 60,
    "cat": "vaz",
    "rot": "Botar pilha"
   },
   {
    "dia": 1,
    "inicio": "16:30",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 2,
    "inicio": "08:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 2,
    "inicio": "09:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "10:30",
    "dur": 90,
    "cat": "vaz",
    "rot": "Criticar antes de experimentar"
   },
   {
    "dia": 2,
    "inicio": "13:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Criticar sem propor solução"
   },
   {
    "dia": 2,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 2,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "16:00",
    "dur": 90,
    "cat": "vaz",
    "rot": "Falar o que ninguém quer ouvir"
   },
   {
    "dia": 3,
    "inicio": "08:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "09:30",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 3,
    "inicio": "10:30",
    "dur": 60,
    "cat": "vaz",
    "rot": "Procurar pelo em ovo"
   },
   {
    "dia": 3,
    "inicio": "11:30",
    "dur": 30,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 3,
    "inicio": "13:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 3,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "15:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Cutucar a onça com vara curta"
   },
   {
    "dia": 3,
    "inicio": "16:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 4,
    "inicio": "08:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Empurrar com a barriga"
   },
   {
    "dia": 4,
    "inicio": "09:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "10:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 4,
    "inicio": "11:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Ficar em cima do muro"
   },
   {
    "dia": 4,
    "inicio": "13:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 4,
    "inicio": "14:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Encher linguiça"
   },
   {
    "dia": 4,
    "inicio": "15:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "16:30",
    "dur": 60,
    "cat": "f1",
    "rot": "Prioridades"
   }
  ]
 },
 {
  "nome": "Semana flexível",
  "desc": "blocos que agrupam: atividades 1, 2 e 3 das 9 ao meio-dia, com respiro e coringa",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 0,
    "inicio": "09:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Atividades 1, 2 e 3"
   },
   {
    "dia": 0,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 0,
    "inicio": "20:30",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 1,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 1,
    "inicio": "09:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Atividades 1, 2 e 3"
   },
   {
    "dia": 1,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 1,
    "inicio": "20:30",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 2,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 2,
    "inicio": "09:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Atividades 1, 2 e 3"
   },
   {
    "dia": 2,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 2,
    "inicio": "20:30",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 3,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 3,
    "inicio": "09:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Atividades 1, 2 e 3"
   },
   {
    "dia": 3,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 3,
    "inicio": "20:30",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 4,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Café da manhã"
   },
   {
    "dia": 4,
    "inicio": "09:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Atividades 1, 2 e 3"
   },
   {
    "dia": 4,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 4,
    "inicio": "20:30",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 0,
    "inicio": "14:00",
    "dur": 180,
    "cat": "vaz",
    "rot": "Atividades 4, 5 e 6"
   },
   {
    "dia": 2,
    "inicio": "14:00",
    "dur": 180,
    "cat": "vaz",
    "rot": "Atividades 4, 5 e 6"
   },
   {
    "dia": 4,
    "inicio": "14:00",
    "dur": 180,
    "cat": "vaz",
    "rot": "Atividades 4, 5 e 6"
   },
   {
    "dia": 1,
    "inicio": "14:00",
    "dur": 120,
    "cat": "f2",
    "rot": "Reuniões da tarde"
   },
   {
    "dia": 1,
    "inicio": "16:00",
    "dur": 90,
    "cat": "vaz",
    "rot": "Atividades 4 e 5"
   },
   {
    "dia": 3,
    "inicio": "14:00",
    "dur": 120,
    "cat": "f2",
    "rot": "Reuniões da tarde"
   },
   {
    "dia": 3,
    "inicio": "16:00",
    "dur": 90,
    "cat": "vaz",
    "rot": "Atividades 4 e 5"
   },
   {
    "dia": 0,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 1,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 2,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 3,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 4,
    "inicio": "17:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Coringa"
   }
  ]
 },
 {
  "nome": "Atividades do exemplo",
  "desc": "os 15 horários da cena do encaixe: sono todo dia, treino, planejamento, e o resto na semana",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 240,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 0,
    "inicio": "08:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Planejamento da semana"
   },
   {
    "dia": 0,
    "inicio": "09:00",
    "dur": 120,
    "cat": "f1",
    "rot": "Proposta do cliente"
   },
   {
    "dia": 2,
    "inicio": "08:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Fluxo de caixa"
   },
   {
    "dia": 6,
    "inicio": "12:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Almoço em família"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Mentoria"
   },
   {
    "dia": 1,
    "inicio": "10:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião de equipe"
   },
   {
    "dia": 2,
    "inicio": "14:00",
    "dur": 30,
    "cat": "f2",
    "rot": "Ligação com cliente"
   },
   {
    "dia": 4,
    "inicio": "09:00",
    "dur": 120,
    "cat": "f1",
    "rot": "Conteúdo da semana"
   },
   {
    "dia": 4,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Consulta médica"
   },
   {
    "dia": 5,
    "inicio": "10:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Mercado da semana"
   },
   {
    "dia": 2,
    "inicio": "21:00",
    "dur": 45,
    "cat": "f3",
    "rot": "Leitura"
   },
   {
    "dia": 1,
    "inicio": "16:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Responder e-mails"
   },
   {
    "dia": 3,
    "inicio": "16:00",
    "dur": 60,
    "cat": "desvio",
    "rot": "Tempo coringa"
   }
  ]
 },
 {
  "nome": "Semana mapeada (antes)",
  "desc": "135 dias reais de alunos antes da mentoria: dia picado em blocos de 12 min, trabalho até de noite, treino quase zero",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 80,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "06:20",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 0,
    "inicio": "06:35",
    "dur": 45,
    "cat": "vaz",
    "rot": "Banho e café"
   },
   {
    "dia": 0,
    "inicio": "07:20",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 0,
    "inicio": "07:50",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails e WhatsApp"
   },
   {
    "dia": 0,
    "inicio": "08:05",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 0,
    "inicio": "08:50",
    "dur": 10,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 0,
    "inicio": "09:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "09:45",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular"
   },
   {
    "dia": 0,
    "inicio": "10:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 0,
    "inicio": "10:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 0,
    "inicio": "11:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Alinhamento"
   },
   {
    "dia": 0,
    "inicio": "11:45",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails"
   },
   {
    "dia": 0,
    "inicio": "12:00",
    "dur": 40,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "12:40",
    "dur": 20,
    "cat": "cel",
    "rot": "Celular no almoço"
   },
   {
    "dia": 0,
    "inicio": "13:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 0,
    "inicio": "13:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 0,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "15:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 0,
    "inicio": "15:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 0,
    "inicio": "16:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "16:45",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 0,
    "inicio": "17:30",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 0,
    "inicio": "18:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Pendências de casa"
   },
   {
    "dia": 0,
    "inicio": "18:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 30,
    "cat": "cel",
    "rot": "TV / celular"
   },
   {
    "dia": 0,
    "inicio": "19:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Família / casa"
   },
   {
    "dia": 0,
    "inicio": "20:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Trabalho à noite"
   },
   {
    "dia": 0,
    "inicio": "21:30",
    "dur": 30,
    "cat": "f1",
    "rot": "Mapeamento e planner"
   },
   {
    "dia": 0,
    "inicio": "22:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Banho / encerrar o dia"
   },
   {
    "dia": 0,
    "inicio": "22:30",
    "dur": 30,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 80,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "06:20",
    "dur": 30,
    "cat": "f3",
    "rot": "Tentativa de treino"
   },
   {
    "dia": 1,
    "inicio": "06:50",
    "dur": 30,
    "cat": "vaz",
    "rot": "Banho e café"
   },
   {
    "dia": 1,
    "inicio": "07:20",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 1,
    "inicio": "07:50",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails e WhatsApp"
   },
   {
    "dia": 1,
    "inicio": "08:05",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "08:50",
    "dur": 10,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 1,
    "inicio": "09:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "09:45",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular"
   },
   {
    "dia": 1,
    "inicio": "10:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "10:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 1,
    "inicio": "11:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Alinhamento"
   },
   {
    "dia": 1,
    "inicio": "11:45",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails"
   },
   {
    "dia": 1,
    "inicio": "12:00",
    "dur": 40,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "12:40",
    "dur": 20,
    "cat": "cel",
    "rot": "Celular no almoço"
   },
   {
    "dia": 1,
    "inicio": "13:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "13:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 1,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "15:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "15:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 1,
    "inicio": "16:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "16:45",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "17:30",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 1,
    "inicio": "18:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Pendências de casa"
   },
   {
    "dia": 1,
    "inicio": "18:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 30,
    "cat": "cel",
    "rot": "TV / celular"
   },
   {
    "dia": 1,
    "inicio": "19:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Família / casa"
   },
   {
    "dia": 1,
    "inicio": "20:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Trabalho à noite"
   },
   {
    "dia": 1,
    "inicio": "21:30",
    "dur": 30,
    "cat": "f1",
    "rot": "Mapeamento e planner"
   },
   {
    "dia": 1,
    "inicio": "22:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Banho / encerrar o dia"
   },
   {
    "dia": 1,
    "inicio": "22:30",
    "dur": 30,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 80,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "06:20",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 2,
    "inicio": "06:35",
    "dur": 45,
    "cat": "vaz",
    "rot": "Banho e café"
   },
   {
    "dia": 2,
    "inicio": "07:20",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 2,
    "inicio": "07:50",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails e WhatsApp"
   },
   {
    "dia": 2,
    "inicio": "08:05",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "08:50",
    "dur": 10,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 2,
    "inicio": "09:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "09:45",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular"
   },
   {
    "dia": 2,
    "inicio": "10:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "10:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 2,
    "inicio": "11:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Alinhamento"
   },
   {
    "dia": 2,
    "inicio": "11:45",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails"
   },
   {
    "dia": 2,
    "inicio": "12:00",
    "dur": 40,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "12:40",
    "dur": 20,
    "cat": "cel",
    "rot": "Celular no almoço"
   },
   {
    "dia": 2,
    "inicio": "13:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "13:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 2,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "15:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "15:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 2,
    "inicio": "16:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "16:45",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "17:30",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 2,
    "inicio": "18:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Pendências de casa"
   },
   {
    "dia": 2,
    "inicio": "18:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 30,
    "cat": "cel",
    "rot": "TV / celular"
   },
   {
    "dia": 2,
    "inicio": "19:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Família / casa"
   },
   {
    "dia": 2,
    "inicio": "20:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Trabalho à noite"
   },
   {
    "dia": 2,
    "inicio": "21:30",
    "dur": 30,
    "cat": "f1",
    "rot": "Mapeamento e planner"
   },
   {
    "dia": 2,
    "inicio": "22:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Banho / encerrar o dia"
   },
   {
    "dia": 2,
    "inicio": "22:30",
    "dur": 30,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 80,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "06:20",
    "dur": 30,
    "cat": "f3",
    "rot": "Tentativa de treino"
   },
   {
    "dia": 3,
    "inicio": "06:50",
    "dur": 30,
    "cat": "vaz",
    "rot": "Banho e café"
   },
   {
    "dia": 3,
    "inicio": "07:20",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 3,
    "inicio": "07:50",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails e WhatsApp"
   },
   {
    "dia": 3,
    "inicio": "08:05",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "08:50",
    "dur": 10,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 3,
    "inicio": "09:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "09:45",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular"
   },
   {
    "dia": 3,
    "inicio": "10:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "10:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 3,
    "inicio": "11:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Alinhamento"
   },
   {
    "dia": 3,
    "inicio": "11:45",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails"
   },
   {
    "dia": 3,
    "inicio": "12:00",
    "dur": 40,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "12:40",
    "dur": 20,
    "cat": "cel",
    "rot": "Celular no almoço"
   },
   {
    "dia": 3,
    "inicio": "13:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "13:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 3,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "15:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "15:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 3,
    "inicio": "16:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "16:45",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "17:30",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 3,
    "inicio": "18:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Pendências de casa"
   },
   {
    "dia": 3,
    "inicio": "18:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 30,
    "cat": "cel",
    "rot": "TV / celular"
   },
   {
    "dia": 3,
    "inicio": "19:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Família / casa"
   },
   {
    "dia": 3,
    "inicio": "20:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Trabalho à noite"
   },
   {
    "dia": 3,
    "inicio": "21:30",
    "dur": 30,
    "cat": "f1",
    "rot": "Mapeamento e planner"
   },
   {
    "dia": 3,
    "inicio": "22:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Banho / encerrar o dia"
   },
   {
    "dia": 3,
    "inicio": "22:30",
    "dur": 30,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 80,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "06:20",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 4,
    "inicio": "06:35",
    "dur": 45,
    "cat": "vaz",
    "rot": "Banho e café"
   },
   {
    "dia": 4,
    "inicio": "07:20",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 4,
    "inicio": "07:50",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails e WhatsApp"
   },
   {
    "dia": 4,
    "inicio": "08:05",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "08:50",
    "dur": 10,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 4,
    "inicio": "09:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "09:45",
    "dur": 15,
    "cat": "cel",
    "rot": "Celular"
   },
   {
    "dia": 4,
    "inicio": "10:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "10:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 4,
    "inicio": "11:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Alinhamento"
   },
   {
    "dia": 4,
    "inicio": "11:45",
    "dur": 15,
    "cat": "f1",
    "rot": "E-mails"
   },
   {
    "dia": 4,
    "inicio": "12:00",
    "dur": 40,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "12:40",
    "dur": 20,
    "cat": "cel",
    "rot": "Celular no almoço"
   },
   {
    "dia": 4,
    "inicio": "13:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "13:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Interrupção"
   },
   {
    "dia": 4,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "15:00",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "15:45",
    "dur": 15,
    "cat": "vaz",
    "rot": "Café / banheiro"
   },
   {
    "dia": 4,
    "inicio": "16:00",
    "dur": 45,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "16:45",
    "dur": 45,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "17:30",
    "dur": 30,
    "cat": "vaz",
    "rot": "Deslocamento"
   },
   {
    "dia": 4,
    "inicio": "18:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Pendências de casa"
   },
   {
    "dia": 4,
    "inicio": "18:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 30,
    "cat": "cel",
    "rot": "TV / celular"
   },
   {
    "dia": 4,
    "inicio": "19:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Família / casa"
   },
   {
    "dia": 4,
    "inicio": "20:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Trabalho à noite"
   },
   {
    "dia": 4,
    "inicio": "21:30",
    "dur": 30,
    "cat": "f1",
    "rot": "Mapeamento e planner"
   },
   {
    "dia": 4,
    "inicio": "22:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Banho / encerrar o dia"
   },
   {
    "dia": 4,
    "inicio": "22:30",
    "dur": 30,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 210,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "08:30",
    "dur": 30,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 5,
    "inicio": "09:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Café e casa"
   },
   {
    "dia": 5,
    "inicio": "10:00",
    "dur": 90,
    "cat": "vaz",
    "rot": "Mercado / rua"
   },
   {
    "dia": 5,
    "inicio": "11:30",
    "dur": 90,
    "cat": "f3",
    "rot": "Almoço em família"
   },
   {
    "dia": 5,
    "inicio": "13:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Série / celular"
   },
   {
    "dia": 5,
    "inicio": "14:00",
    "dur": 60,
    "cat": "f1",
    "rot": "Pendências do trabalho"
   },
   {
    "dia": 5,
    "inicio": "15:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família / casa"
   },
   {
    "dia": 5,
    "inicio": "17:00",
    "dur": 60,
    "cat": "cel",
    "rot": "Celular"
   },
   {
    "dia": 5,
    "inicio": "18:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Jantar / social"
   },
   {
    "dia": 5,
    "inicio": "20:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Sair / receber gente"
   },
   {
    "dia": 5,
    "inicio": "22:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Série até tarde"
   },
   {
    "dia": 5,
    "inicio": "23:30",
    "dur": 30,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 165,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "07:45",
    "dur": 45,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 6,
    "inicio": "08:30",
    "dur": 90,
    "cat": "vaz",
    "rot": "Café e casa"
   },
   {
    "dia": 6,
    "inicio": "10:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família / igreja / rua"
   },
   {
    "dia": 6,
    "inicio": "12:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Almoço em família"
   },
   {
    "dia": 6,
    "inicio": "13:30",
    "dur": 60,
    "cat": "f3",
    "rot": "Descanso"
   },
   {
    "dia": 6,
    "inicio": "14:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Curso / mentoria"
   },
   {
    "dia": 6,
    "inicio": "15:30",
    "dur": 90,
    "cat": "f3",
    "rot": "Série / celular"
   },
   {
    "dia": 6,
    "inicio": "17:00",
    "dur": 90,
    "cat": "f3",
    "rot": "Família / casa"
   },
   {
    "dia": 6,
    "inicio": "18:30",
    "dur": 60,
    "cat": "f3",
    "rot": "Jantar"
   },
   {
    "dia": 6,
    "inicio": "19:30",
    "dur": 60,
    "cat": "f3",
    "rot": "TV"
   },
   {
    "dia": 6,
    "inicio": "20:30",
    "dur": 60,
    "cat": "f1",
    "rot": "E-mails pra semana"
   },
   {
    "dia": 6,
    "inicio": "21:30",
    "dur": 60,
    "cat": "vaz",
    "rot": "Encerrar o domingo"
   },
   {
    "dia": 6,
    "inicio": "22:30",
    "dur": 30,
    "cat": "cel",
    "rot": "Celular na cama"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   }
  ]
 },
 {
  "nome": "Semana caótica",
  "desc": "reunião em cima de reunião, sem espaço entre nada",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "06:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 0,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "08:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 0,
    "inicio": "08:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "10:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 0,
    "inicio": "10:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "11:30",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 0,
    "inicio": "12:00",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "12:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "13:30",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 0,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "16:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 0,
    "inicio": "16:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "18:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "20:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 0,
    "inicio": "22:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 1,
    "inicio": "06:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 1,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "08:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 1,
    "inicio": "08:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "10:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 1,
    "inicio": "10:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "11:30",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 1,
    "inicio": "12:00",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "12:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "13:30",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "16:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 1,
    "inicio": "16:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "18:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "20:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 1,
    "inicio": "22:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 2,
    "inicio": "06:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 2,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "08:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 2,
    "inicio": "08:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "10:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 2,
    "inicio": "10:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "11:30",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 2,
    "inicio": "12:00",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "12:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "13:30",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 2,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "16:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 2,
    "inicio": "16:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "18:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "20:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 2,
    "inicio": "22:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 3,
    "inicio": "06:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 3,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "08:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 3,
    "inicio": "08:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "10:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 3,
    "inicio": "10:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "11:30",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 3,
    "inicio": "12:00",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "12:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "13:30",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 3,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "16:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 3,
    "inicio": "16:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "18:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "20:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 3,
    "inicio": "22:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 4,
    "inicio": "06:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 4,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "08:00",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 4,
    "inicio": "08:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "10:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 4,
    "inicio": "10:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "11:30",
    "dur": 30,
    "cat": "desvio",
    "rot": "Coringa"
   },
   {
    "dia": 4,
    "inicio": "12:00",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "12:30",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "13:30",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 4,
    "inicio": "15:00",
    "dur": 60,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "16:00",
    "dur": 30,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 4,
    "inicio": "16:30",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "18:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 90,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "20:30",
    "dur": 90,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 4,
    "inicio": "22:00",
    "dur": 60,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 5,
    "inicio": "09:00",
    "dur": 120,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 5,
    "inicio": "14:00",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 5,
    "inicio": "20:00",
    "dur": 120,
    "cat": "desvio",
    "rot": "Celular"
   },
   {
    "dia": 6,
    "inicio": "09:00",
    "dur": 120,
    "cat": "vaz",
    "rot": "Atividade"
   },
   {
    "dia": 6,
    "inicio": "14:00",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 6,
    "inicio": "20:00",
    "dur": 120,
    "cat": "desvio",
    "rot": "Celular"
   }
  ]
 },
 {
  "nome": "Semana equilibrada",
  "desc": "blocos longos, espaço entre eles, fim de semana ocupado",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 180,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 180,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 0,
    "inicio": "08:30",
    "dur": 150,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 0,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "13:30",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 0,
    "inicio": "16:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 1,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 1,
    "inicio": "08:30",
    "dur": 150,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "13:30",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 1,
    "inicio": "16:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 2,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 2,
    "inicio": "08:30",
    "dur": 150,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 2,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "13:30",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 2,
    "inicio": "16:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 3,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 3,
    "inicio": "08:30",
    "dur": 150,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 3,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "13:30",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 3,
    "inicio": "16:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 4,
    "inicio": "07:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Treino"
   },
   {
    "dia": 4,
    "inicio": "08:30",
    "dur": 150,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 4,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "13:30",
    "dur": 120,
    "cat": "f2",
    "rot": "Reunião"
   },
   {
    "dia": 4,
    "inicio": "16:00",
    "dur": 90,
    "cat": "f1",
    "rot": "Prioridades"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 5,
    "inicio": "09:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 5,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 5,
    "inicio": "15:00",
    "dur": 180,
    "cat": "f3",
    "rot": "Lazer"
   },
   {
    "dia": 5,
    "inicio": "19:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 6,
    "inicio": "09:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   },
   {
    "dia": 6,
    "inicio": "12:00",
    "dur": 60,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 6,
    "inicio": "15:00",
    "dur": 180,
    "cat": "f3",
    "rot": "Lazer"
   },
   {
    "dia": 6,
    "inicio": "19:00",
    "dur": 120,
    "cat": "f3",
    "rot": "Família"
   }
  ]
 },
 {
  "nome": "Só o trabalho",
  "desc": "para mostrar o que sobra quando tudo é trabalho",
  "blocos": [
   {
    "dia": 0,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 1,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 2,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 3,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "05:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 4,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 5,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "05:00",
    "dur": 120,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 6,
    "inicio": "23:00",
    "dur": 60,
    "cat": "sono",
    "rot": "Dormir"
   },
   {
    "dia": 0,
    "inicio": "07:00",
    "dur": 300,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 0,
    "inicio": "12:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 0,
    "inicio": "13:00",
    "dur": 330,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 0,
    "inicio": "19:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "07:00",
    "dur": 300,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "12:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 1,
    "inicio": "13:00",
    "dur": 330,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 1,
    "inicio": "19:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "07:00",
    "dur": 300,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "12:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 2,
    "inicio": "13:00",
    "dur": 330,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 2,
    "inicio": "19:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "07:00",
    "dur": 300,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "12:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 3,
    "inicio": "13:00",
    "dur": 330,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 3,
    "inicio": "19:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "07:00",
    "dur": 300,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "12:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 4,
    "inicio": "13:00",
    "dur": 330,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 4,
    "inicio": "19:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 5,
    "inicio": "07:00",
    "dur": 300,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 5,
    "inicio": "12:30",
    "dur": 30,
    "cat": "f3",
    "rot": "Almoço"
   },
   {
    "dia": 5,
    "inicio": "13:00",
    "dur": 330,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 5,
    "inicio": "19:00",
    "dur": 180,
    "cat": "f1",
    "rot": "Trabalho"
   },
   {
    "dia": 6,
    "inicio": "10:00",
    "dur": 240,
    "cat": "f1",
    "rot": "Trabalho"
   }
  ]
 }
] as ModeloSemana[];

/** Acha um modelo pelo nome, ignorando acentos e caixa. */
export function acharModelo(nome: string | undefined | null): ModeloSemana | null {
  if (!nome) return null;
  const limpo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const alvo = limpo(nome);
  return MODELOS_SEMANA.find((m) => limpo(m.nome) === alvo) ?? MODELOS_SEMANA.find((m) => limpo(m.nome).includes(alvo) || alvo.includes(limpo(m.nome))) ?? null;
}

/** Lista "nome — descrição" para o prompt. */
export const MODELOS_RESUMO = MODELOS_SEMANA.map((m) => `"${m.nome}" (${m.desc})`).join("; ");
