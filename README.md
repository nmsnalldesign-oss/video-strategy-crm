# Video Strategy CRM

Браузерная рабочая область для двух человек: ссылки на референсы, треки, сценарии, раскадровки, статусы реализации и быстрые итоги по тому, что залетело.

## Что уже есть

- отдельная карточка для каждой идеи;
- ссылка на референс Instagram / TikTok / YouTube;
- поля для трека, сценария, стратегии и исполнителя;
- загрузка картинок раскадровки прямо в карточку;
- статусы: `Идея`, `Взял`, `Пробует`, `Попробовал`, `Залетело`, `Не залетело`;
- поиск и фильтры по статусам;
- счетчики по идеям, активным задачам и проценту успешных тестов;
- импорт и экспорт JSON;
- локальный режим без сервера;
- опциональный онлайн-режим через Supabase или Firebase.

## Как открыть

Открой файл:

```text
public/index.html
```

Приложение работает как обычная статическая страница. В локальном режиме данные сохраняются в браузере через `localStorage`.

## Как сделать ссылку другу 24/7 через GitHub

Нужны две вещи:

1. Разместить папку `public` на GitHub Pages.
2. Подключить Supabase для общей базы.

Сервер на твоем компьютере не нужен.

### GitHub Pages

1. Создай новый публичный репозиторий на GitHub.
2. Загрузи в него файлы из папки `public`.
3. Открой `Settings` -> `Pages`.
4. В `Build and deployment` выбери `Deploy from a branch`.
5. Выбери ветку `main` и папку `/root`.
6. Сохрани. GitHub даст ссылку вида `https://username.github.io/repository-name/`.

### Supabase через GitHub

Другу аккаунт не нужен. Аккаунт нужен только один раз тому, кто создает Supabase-проект.

1. Зайди на `https://supabase.com/dashboard`.
2. Войди через GitHub.
3. Создай новый project.
4. Открой `SQL Editor`.
5. Выполни SQL:

```sql
create table if not exists public.rooms (
  id text primary key,
  ideas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "public room read"
on public.rooms for select
using (true);

create policy "public room write"
on public.rooms for insert
with check (true);

create policy "public room update"
on public.rooms for update
using (true)
with check (true);
```

6. Открой `Project Settings` -> `API`.
7. Скопируй `Project URL`.
8. Скопируй `anon public` key.
9. Открой CRM по GitHub Pages ссылке.
10. Нажми `Настройки`.
11. Выбери `Supabase через GitHub`.
12. Укажи ID комнаты, например `vanya-strategy`.
13. Вставь `Project URL` и `anon public key`.
14. Нажми `Сохранить и подключить`.
15. Нажми `Скопировать ссылку другу`.

Эта ссылка будет содержать ID комнаты и публичные Supabase-настройки. Это нормально для `anon public` ключа. Правила выше специально разрешают доступ без логина, чтобы друг просто открыл ссылку.

## Firebase без логина для друга

Firebase тоже поддерживается, если удобнее через Google.

1. Создай проект на Firebase.
2. Включи Firestore Database.
3. В настройках веб-приложения Firebase скопируй config JSON.
4. Открой CRM, нажми `Настройки`.
5. Вставь config JSON.
6. Укажи ID комнаты, например `vanya-strategy`.
7. Нажми `Сохранить и подключить`.
8. Нажми `Скопировать ссылку другу`.

Firebase config попадет в ссылку. Это нормально: config веб-приложений Firebase публичный по своей природе. Доступ лучше ограничить правилами Firestore.

Минимальные правила для личной комнаты:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if roomId == "vanya-strategy";
    }
  }
}
```

Если хочется новую комнату, поменяй `vanya-strategy` в правилах и в настройках приложения на один и тот же ID.

## Важное ограничение

Полностью онлайн, 24/7, с общей базой и вообще без какого-либо внешнего аккаунта сделать нельзя: данные должны где-то храниться. В этом проекте код уже готов так, чтобы друг не логинился и не запускал сервер, но один storage-провайдер все равно нужен.

## Проверка

```bash
npm test
```

Тесты проверяют ядро карточек, статусы, фильтры, статистику и импорт-экспорт.
