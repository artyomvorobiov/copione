# Интеграционные тесты облачного бэкенда

Настоящий `SupabaseBackend` (код приложения) прогоняется против локального стека, собранного из официальных образов Supabase: Postgres, GoTrue (Auth) и PostgREST, плюс маленький шлюз вместо Kong. Тесты регистрируют двух пользователей и проверяют профили, оценки, дневник, ленту, лайки, комментарии, статистику, сериалы, списки, Мэтч, Row Level Security, блокировки и удаление аккаунта.

Нужен Docker.

```bash
tests/supabase/stack.sh up        # поднять Postgres + Auth + PostgREST
tests/supabase/stack.sh schema    # применить supabase/schema.sql (как SQL Editor)
node tests/supabase/gateway.mjs & # шлюз на http://127.0.0.1:54321

eval "$(node tests/supabase/keys.mjs)"
ANON_KEY=$ANON_KEY npm run test:supabase

tests/supabase/stack.sh down      # остановить
```

Если Docker Hub упирается в лимиты, укажите зеркало: `REGISTRY=mirror.gcr.io tests/supabase/stack.sh up` (по умолчанию уже оно).

Тот же стек годится, чтобы погонять приложение в облачном режиме без настоящего проекта Supabase:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY npx expo start --web
```
