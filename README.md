# Family Loves Food

Dieta en calendari, llista de la compra i repartiment de tiquets per a casa compartida.
Next.js + Supabase, preparada per instal·lar-se a l'iPhone com una app (PWA).

## Què hi ha fet

- Entrar i crear compte (correu i contrasenya).
- **Calendari**: un dia cada vegada al mòbil i a l'iPad vertical; tota la setmana a l'iPad horitzontal i a l'ordinador. Afegir i treure plats, racions, copiar la setmana a la següent i veure el calendari d'algú que te l'ha compartit.
- **Plats**: crear, editar i esborrar plats amb els ingredients per ració. Els plats de la resta del grup es veuen però només els edita qui els ha creat.
- **Grup**: crear un grup, entrar amb codi, sortir-ne, triar qui veu o edita el teu calendari i canviar el teu nom.
- **Compra** i **Tiquets**: pantalles preparades, són les següents que es construeixen.

## Posar-la en marxa al teu ordinador

Necessites Node.js 20 o més nou.

```bash
npm install
cp .env.example .env.local   # i hi poses la Project URL i la clau anon de Supabase
npm run dev
```

Obre http://localhost:3000.

## Publicar-la

Es pot publicar a Vercel o a Netlify connectant el repositori. Cal afegir les mateixes dues variables
(`NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`) a la configuració del servei.

A Supabase, a **Authentication > URL Configuration**, posa l'adreça publicada com a *Site URL*.

## Instal·lar-la a l'iPhone

Obre l'adreça a Safari, prem el botó de compartir i tria **Afegeix a la pantalla d'inici**.

## Estructura

```
src/
  proxy.ts                 protecció de rutes i sessió de Supabase
  app/login/               entrar i crear compte
  app/(app)/page.tsx       calendari
  app/(app)/plats/         plats i ingredients
  app/(app)/grup/          grups i compartir calendari
  app/(app)/compra/        (properament)
  app/(app)/tiquets/       (properament)
  components/              menú, finestres, capçaleres
  lib/                     client de Supabase, tipus i dates
public/sw.js               service worker
supabase/schema.sql        esquema de la base de dades
```
