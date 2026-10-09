# DevDesk — Helpdesk & Issue Tracking API

Сервис обработки клиентских обращений и технической поддержки с ролевой моделью доступа (RBAC), построенный на стеке **Django REST Framework, PostgreSQL, Gunicorn и Nginx** в изолированном Docker-окружении.

---

## Архитектура и стек технологий

Проект спроектирован по принципу разделения ответственности и минимизации накладных расходов на бэкенд:

* **Бэкенд:** Python 3.12, Django 5.1, Django REST Framework
* **Аутентификация:** JWT (djangorestframework-simplejwt) с кастомными claims (роли пользователей)
* **База данных:** PostgreSQL 16
* **WSGI-сервер:** Gunicorn (пул воркеров)
* **Веб-сервер / Reverse Proxy:** Nginx (раздача статики, SPA-клиента и терминация запросов к API)
* **Документация API:** OpenAPI 3 / Swagger (drf-spectacular)
* **Контейнеризация:** Docker, Docker Compose (multi-stage build, запуск от непривилегированного пользователя)

### Схема движения трафика

```text
               Браузер (Клиент)
                       │
                       ▼ [Порт 80]
              Nginx (Reverse Proxy)
         ┌─────────────┴─────────────┐
         ▼                           ▼
 Раздача фронтенда         Проксирование динамики
 (SPA / Static / Media)       (/api/*, /admin/*)
                                     │
                                     ▼ [Порт 8000]
                             Gunicorn (3 воркера)
                                     │
                              Django REST API
                                     │
                                     ▼ [Внутренняя сеть]
                              PostgreSQL 16
