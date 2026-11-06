-- Supabase seed data. Applied after migrations on `supabase db reset`.
--
-- SAFE SEED ONLY: public, non-sensitive content that mirrors what the static
-- portfolio already shows. No secrets, no credentials, no admin_profiles row
-- (the administrator profile is inserted in M3-T2 using the real auth user id,
-- never hardcoded here). Idempotent via fixed ids + ON CONFLICT DO NOTHING.

-- ---------------------------------------------------------------------------
-- Projects (the two featured projects already in ProjectsSection) + fr/en/ar
-- ---------------------------------------------------------------------------

insert into public.projects (id, slug, status, featured, sort_order, cover_image_url, repo_url, demo_url, tech_stack, started_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'event-booking-app',
    'published', true, 0,
    '/images/event-booking-app.png',
    'https://github.com/Keltoummalouki/event-booking-app',
    null,
    array['NestJS', 'Next.js', 'TypeScript', 'PostgreSQL', 'Docker', 'GitHub Actions', 'Jira'],
    '2025-12-01'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'reservez-moi',
    'published', true, 1,
    '/images/reservezmoi.png',
    'https://github.com/keltoummalouki/Reservez-Moi',
    null,
    array['Laravel', 'MySQL', 'HTML', 'Tailwind CSS', 'JavaScript', 'UML', 'Jira', 'Git/GitHub'],
    '2025-04-01'
  )
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, description)
values
  -- Event Booking App
  ('11111111-1111-4111-8111-111111111111', 'fr', 'Event Booking App',
   'Application de gestion d''événements avec système de réservation et gestion des rôles utilisateurs.'),
  ('11111111-1111-4111-8111-111111111111', 'en', 'Event Booking App',
   'Event management application with booking system and user-role management.'),
  ('11111111-1111-4111-8111-111111111111', 'ar', 'Event Booking App',
   'تطبيق لإدارة الفعاليات مع نظام حجز وإدارة أدوار المستخدمين.'),
  -- Réservez-Moi
  ('22222222-2222-4222-8222-222222222222', 'fr', 'Réservez-Moi',
   'Plateforme de réservation de services avec gestion des disponibilités et des réservations.'),
  ('22222222-2222-4222-8222-222222222222', 'en', 'Réservez-Moi',
   'Service-booking platform with availability and reservation management.'),
  ('22222222-2222-4222-8222-222222222222', 'ar', 'Réservez-Moi',
   'منصة لحجز الخدمات مع إدارة التوفر والحجوزات.')
on conflict (project_id, locale) do nothing;

-- Case studies (Markdown) for the two projects above. Identical to the backfill
-- in migrations/20261003120000_project_case_studies.sql (which runs before this
-- seed, while the projects do not exist yet). Only fills empty case studies.

update public.project_translations
set body_markdown = $cs$## Vue d'ensemble

Event Booking App est une application web full stack réalisée par Keltoum Malouki, développeuse web full stack basée à Casablanca, au Maroc, pour gérer des événements et leurs réservations avec une gestion rigoureuse des rôles et de la sécurité. L'application associe une API NestJS, une interface Next.js en TypeScript et une base de données PostgreSQL, conteneurisées avec Docker et vérifiées par un pipeline d'intégration continue GitHub Actions.

## Le problème

Les organisations qui proposent des formations, des ateliers ou des conférences gèrent souvent les inscriptions à la main, avec des fichiers Excel et des échanges d'e-mails. Event Booking App centralise les événements et les réservations au même endroit et remplace ces étapes manuelles par un processus automatisé et sécurisé.

## Mon rôle

J'ai travaillé sur ce projet en tant que développeuse full stack, de la conception à la livraison :

- modélisation du domaine avec des diagrammes UML de cas d'utilisation et de classes ;
- organisation du backlog en epics et en user stories (authentification, gestion des événements, système de réservation, interface et tickets PDF), suivies dans Jira ;
- développement de l'API NestJS et de l'interface Next.js ;
- écriture de tests unitaires et de tests de bout en bout ;
- conteneurisation avec Docker Compose et mise en place du pipeline GitHub Actions.

## Fonctionnalités clés

**Pour les participants**

- Consulter les événements publiés.
- Réserver une place sur un événement tant qu'il n'est pas complet.
- Consulter et annuler ses réservations.
- Télécharger un ticket PDF avec QR code une fois la réservation confirmée.

**Pour les administrateurs**

- Créer des événements en brouillon, puis les modifier, les publier ou les annuler.
- Confirmer, refuser ou annuler les réservations en attente.
- Consulter les réservations par événement et par participant.
- Suivre des indicateurs comme le taux de remplissage et les statuts des réservations.

## Stack technique et architecture

| Couche | Technologies |
|---|---|
| Front-end | Next.js, TypeScript, React Hook Form, Zod |
| Back-end | NestJS, TypeScript, TypeORM, JWT, class-validator |
| Base de données | PostgreSQL |
| Tests | Jest, React Testing Library |
| DevOps | Docker, Docker Compose, GitHub Actions |
| Gestion de projet | Git, GitHub, Jira |

Le dépôt est divisé en deux applications, `backend` (NestJS) et `frontend` (Next.js), orchestrées avec Docker Compose aux côtés d'un conteneur PostgreSQL. L'API est organisée en modules fonctionnels — authentification, utilisateurs, événements et réservations — chacun avec son contrôleur, son service, ses DTO et ses entités. Les tickets PDF sont générés côté serveur avec PDFKit, et chaque ticket porte un QR code qui renvoie à sa réservation.

## Approche : sécurité et qualité

La sécurité est intégrée à l'API dès le départ, plutôt qu'ajoutée à la fin :

- authentification JWT et hachage des mots de passe avec bcrypt ;
- contrôle d'accès basé sur les rôles (RBAC), qui sépare administrateurs et participants ;
- validation des entrées sur chaque requête grâce aux DTO et à class-validator ;
- politique CORS configurée, avec les secrets conservés dans des variables d'environnement.

Les règles de réservation sont appliquées côté serveur : seuls les événements publiés peuvent être réservés, l'API vérifie la capacité de l'événement par rapport aux réservations confirmées, et un participant ne peut pas réserver deux fois le même événement.

Les push et les pull requests déclenchent un pipeline GitHub Actions qui analyse le code (lint), exécute les tests et compile séparément le back-end et le front-end. Les tests de bout en bout du back-end s'exécutent sur un conteneur de service PostgreSQL, et les images Docker sont construites une fois tous les autres jobs réussis. Les commits suivent la convention Conventional Commits et référencent les tickets Jira.

## Liens

- Code source : [github.com/Keltoummalouki/event-booking-app](https://github.com/Keltoummalouki/event-booking-app)
- Autres études de cas : [Tous les projets](/fr/projects)
- Besoin d'une application similaire ? [Travaillons ensemble](/fr/freelance)$cs$
where body_markdown is null
  and locale = 'fr'
  and project_id = (select id from public.projects where slug = 'event-booking-app');

update public.project_translations
set body_markdown = $cs$## Overview

Event Booking App is a full-stack web application built by Keltoum Malouki, a Full Stack Web Developer based in Casablanca, Morocco, to manage events and their bookings with strict role management and security. It combines a NestJS API, a Next.js and TypeScript interface and a PostgreSQL database, packaged with Docker and checked by a GitHub Actions CI pipeline.

## The problem

Organizations that run trainings, workshops and conferences often handle registrations by hand, with spreadsheets and email threads. Event Booking App centralizes events and bookings in one place and replaces those manual steps with an automated and secure workflow.

## My role

I worked on the project as a full-stack developer, from design to delivery:

- modelling the domain with UML use-case and class diagrams;
- organizing the backlog into epics and user stories (authentication, event management, booking system, interface and PDF tickets), tracked in Jira;
- building the NestJS API and the Next.js interface;
- writing unit and end-to-end tests;
- containerizing the stack with Docker Compose and setting up the GitHub Actions pipeline.

## Key features

**For participants**

- Browse published events.
- Book a seat on an event, as long as it is not full.
- View and cancel their bookings.
- Download a PDF ticket with a QR code once a booking is confirmed.

**For administrators**

- Create events as drafts, then edit, publish or cancel them.
- Confirm, refuse or cancel pending bookings.
- View bookings by event and by participant.
- Follow indicators such as the fill rate and booking statuses.

## Tech stack & architecture

| Layer | Technologies |
|---|---|
| Front end | Next.js, TypeScript, React Hook Form, Zod |
| Back end | NestJS, TypeScript, TypeORM, JWT, class-validator |
| Database | PostgreSQL |
| Testing | Jest, React Testing Library |
| DevOps | Docker, Docker Compose, GitHub Actions |
| Project management | Git, GitHub, Jira |

The repository is split into a `backend` application (NestJS) and a `frontend` application (Next.js), orchestrated with Docker Compose alongside a PostgreSQL container. The API is organized into feature modules — authentication, users, events and bookings — each with its own controller, service, DTOs and entities. PDF tickets are generated on the server with PDFKit, and each ticket carries a QR code that references its booking.

## Approach: security and quality

Security is built into the API rather than added at the end:

- JWT authentication and password hashing with bcrypt;
- role-based access control (RBAC) that separates administrators from participants;
- input validation on every request through DTOs and class-validator;
- a configured CORS policy, with secrets kept in environment variables.

Booking rules are enforced on the server: only published events can be booked, the API checks the event's capacity against confirmed bookings, and a participant cannot book the same event twice.

Pushes and pull requests trigger a GitHub Actions pipeline that lints, tests and builds the back end and the front end separately. The back-end end-to-end tests run against a PostgreSQL service container, and Docker images are built once all the other jobs pass. Commits follow the Conventional Commits style and reference Jira tickets.

## Links

- Source code: [github.com/Keltoummalouki/event-booking-app](https://github.com/Keltoummalouki/event-booking-app)
- More case studies: [All projects](/en/projects)
- Need a similar application? [Work with me](/en/freelance)$cs$
where body_markdown is null
  and locale = 'en'
  and project_id = (select id from public.projects where slug = 'event-booking-app');

update public.project_translations
set body_markdown = $cs$## نظرة عامة

Event Booking App تطبيق ويب متكامل (Full Stack) طوّرته كلثوم ملوكي (Keltoum Malouki)، مطورة ويب متكاملة مقيمة في الدار البيضاء بالمغرب، لإدارة الفعاليات وحجوزاتها مع إدارة صارمة للأدوار والأمان. يجمع التطبيق بين واجهة برمجية (API) مبنية بـ NestJS، وواجهة مستخدم مبنية بـ Next.js وTypeScript، وقاعدة بيانات PostgreSQL، مع حاويات Docker وخط تكامل مستمر (CI) عبر GitHub Actions.

## المشكلة

كثيراً ما تدير المؤسسات التي تنظّم الدورات التدريبية وورش العمل والمؤتمرات التسجيلات يدوياً باستخدام جداول Excel والبريد الإلكتروني. يجمع Event Booking App الفعاليات والحجوزات في مكان واحد، ويستبدل هذه الخطوات اليدوية بمسار عمل آلي وآمن.

## دوري

عملت على هذا المشروع بصفتي مطورة ويب متكاملة، من التصميم إلى التسليم:

- نمذجة المجال باستخدام مخططات UML لحالات الاستخدام والأصناف؛
- تنظيم قائمة المهام (Backlog) في ملاحم (Epics) وقصص مستخدمين: المصادقة، وإدارة الفعاليات، ونظام الحجز، والواجهة وتذاكر PDF، مع متابعتها في Jira؛
- تطوير الواجهة البرمجية بـ NestJS وواجهة المستخدم بـ Next.js؛
- كتابة اختبارات الوحدات والاختبارات الشاملة (End-to-End)؛
- تشغيل المشروع في حاويات عبر Docker Compose وإعداد خط GitHub Actions.

## الميزات الرئيسية

**للمشاركين**

- تصفّح الفعاليات المنشورة.
- حجز مقعد في فعالية ما دامت غير مكتملة العدد.
- الاطلاع على الحجوزات وإلغاؤها.
- تنزيل تذكرة PDF تحمل رمز QR بعد تأكيد الحجز.

**للمسؤولين**

- إنشاء الفعاليات كمسودات، ثم تعديلها أو نشرها أو إلغاؤها.
- تأكيد الحجوزات المعلّقة أو رفضها أو إلغاؤها.
- الاطلاع على الحجوزات حسب الفعالية وحسب المشارك.
- متابعة مؤشرات مثل نسبة الامتلاء وحالات الحجوزات.

## التقنيات والبنية

| الطبقة | التقنيات |
|---|---|
| الواجهة الأمامية | Next.js، TypeScript، React Hook Form، Zod |
| الواجهة الخلفية | NestJS، TypeScript، TypeORM، JWT، class-validator |
| قاعدة البيانات | PostgreSQL |
| الاختبارات | Jest، React Testing Library |
| DevOps | Docker، Docker Compose، GitHub Actions |
| إدارة المشروع | Git، GitHub، Jira |

ينقسم المستودع إلى تطبيقين: `backend` (NestJS) و`frontend` (Next.js)، يعملان معاً عبر Docker Compose إلى جانب حاوية PostgreSQL. تُنظَّم الواجهة البرمجية في وحدات وظيفية — المصادقة، والمستخدمون، والفعاليات، والحجوزات — لكل منها متحكّم وخدمة وكائنات DTO وكيانات خاصة بها. تُولَّد تذاكر PDF على الخادم باستخدام PDFKit، وتحمل كل تذكرة رمز QR يشير إلى الحجز المرتبط بها.

## المنهجية: الأمان والجودة

الأمان مدمج في الواجهة البرمجية منذ البداية، لا مضاف في النهاية:

- مصادقة عبر JWT وتجزئة كلمات المرور (Hashing) باستخدام bcrypt؛
- تحكّم في الوصول قائم على الأدوار (RBAC) يفصل بين المسؤولين والمشاركين؛
- التحقق من المدخلات في كل طلب عبر كائنات DTO ومكتبة class-validator؛
- سياسة CORS مضبوطة، مع حفظ البيانات الحساسة في متغيرات البيئة.

تُطبَّق قواعد الحجز على الخادم: لا يمكن الحجز إلا في الفعاليات المنشورة، وتتحقق الواجهة البرمجية من سعة الفعالية مقارنةً بالحجوزات المؤكدة، ولا يمكن للمشارك حجز الفعالية نفسها مرتين.

يُطلق كل دفع (Push) وكل طلب دمج (Pull Request) خطاً في GitHub Actions يفحص جودة الشيفرة (Lint) ويشغّل الاختبارات ويبني الواجهة الخلفية والواجهة الأمامية كلاً على حدة. تُنفَّذ الاختبارات الشاملة للواجهة الخلفية على حاوية خدمة PostgreSQL، ثم تُبنى صور Docker بعد نجاح جميع المهام الأخرى. وتتبع رسائل الإيداع (Commits) أسلوب Conventional Commits وتشير إلى تذاكر Jira.

## روابط

- الشيفرة المصدرية: [github.com/Keltoummalouki/event-booking-app](https://github.com/Keltoummalouki/event-booking-app)
- دراسات حالة أخرى: [جميع المشاريع](/ar/projects)
- هل تحتاج إلى تطبيق مماثل؟ [لنعمل معاً](/ar/freelance)$cs$
where body_markdown is null
  and locale = 'ar'
  and project_id = (select id from public.projects where slug = 'event-booking-app');

update public.project_translations
set body_markdown = $cs$## Vue d'ensemble

Réservez-Moi est une plateforme web de réservation de services développée avec Laravel et MySQL par Keltoum Malouki, développeuse web full stack basée à Casablanca, au Maroc. La plateforme met en relation clients et prestataires : les clients trouvent un service disponible et le réservent, tandis que les prestataires gèrent leurs services, leurs disponibilités et leurs réservations depuis un tableau de bord dédié.

## Le problème

Réserver un service implique souvent d'appeler ou d'écrire à un prestataire, puis d'attendre sa réponse, pendant que les prestataires suivent leurs réservations à la main. Réservez-Moi réunit le catalogue de services, les disponibilités, les réservations et le paiement en ligne dans une seule plateforme web, avec un espace dédié à chaque type d'utilisateur.

## Mon rôle

J'ai développé la plateforme en tant que développeuse full stack :

- modélisation de l'application en UML et planification du travail dans Jira ;
- conception du schéma de la base MySQL au moyen des migrations Laravel ;
- développement du back-end Laravel : routes, contrôleurs, middlewares, repositories et services ;
- création des interfaces Blade en HTML, Tailwind CSS et JavaScript ;
- gestion de versions avec Git et GitHub.

## Fonctionnalités clés

**Pour les clients**

- Parcourir un catalogue public des services disponibles, avec recherche par mot-clé et filtres par catégorie et par prix.
- Réserver un service à la date et à l'heure choisies, avec des notes facultatives.
- Suivre et annuler ses réservations.
- Payer une réservation en ligne avec PayPal.

**Pour les prestataires**

- Configurer un profil de prestataire.
- Créer, modifier et supprimer des services, avec photos, catégorie, durée et statut de disponibilité.
- Confirmer ou annuler les réservations reçues.
- Suivre l'activité depuis un tableau de bord avec statistiques.

**Pour les administrateurs**

- Gérer les prestataires et les services qu'ils publient.
- Suspendre ou réactiver des comptes prestataires et des services.
- Consulter les statistiques de la plateforme et les exporter.
- Configurer les paramètres de sécurité, de paiement et d'e-mails.

**Comptes et notifications**

- Inscription avec vérification de l'adresse e-mail et réinitialisation du mot de passe.
- Connexion avec Google ou Facebook via Laravel Socialite.
- Notifications à la création, à la confirmation ou à l'annulation d'une réservation.

## Stack technique et architecture

| Couche | Technologies |
|---|---|
| Back-end | Laravel (PHP) |
| Base de données | MySQL |
| Front-end | Blade, HTML, Tailwind CSS, JavaScript |
| Intégrations | PayPal, connexion Google et Facebook (Laravel Socialite) |
| Conception et gestion de projet | UML, Jira, Git, GitHub |

Réservez-Moi suit l'architecture MVC de Laravel, complétée par des couches qui sortent la logique métier des contrôleurs :

- des **repositories**, derrière des interfaces liées dans un service provider, gèrent l'accès aux données des services et des réservations ;
- des **classes de service** portent la logique métier, comme la création d'une réservation ou le traitement des paiements PayPal ;
- des **middlewares** réservent chaque espace de la plateforme au bon rôle : client, prestataire ou administrateur ;
- des **form requests** valident les données avant qu'elles n'atteignent les contrôleurs.

## Approche

La plateforme s'organise autour de trois rôles, chacun avec ses propres routes et son tableau de bord, afin que chaque utilisateur ne voie que les actions qui le concernent. La logique de réservation et de paiement vit dans des classes de service dédiées plutôt que dans les contrôleurs, dans le but de garder des contrôleurs légers et des règles métier centralisées.

## Liens

- Code source : [github.com/keltoummalouki/Reservez-Moi](https://github.com/keltoummalouki/Reservez-Moi)
- Autres études de cas : [Tous les projets](/fr/projects)
- Besoin d'une plateforme de réservation ? [Travaillons ensemble](/fr/freelance)$cs$
where body_markdown is null
  and locale = 'fr'
  and project_id = (select id from public.projects where slug = 'reservez-moi');

update public.project_translations
set body_markdown = $cs$## Overview

Réservez-Moi is a service-booking web platform built with Laravel and MySQL by Keltoum Malouki, a Full Stack Web Developer based in Casablanca, Morocco. It connects clients with service providers: clients find an available service and book it, while providers manage their services, availability and reservations from a dedicated dashboard.

## The problem

Booking a service often means calling or messaging a provider and waiting for an answer, while providers keep track of their bookings by hand. Réservez-Moi brings the service catalogue, availability, reservations and online payment together in one web platform, with a dedicated space for each type of user.

## My role

I developed the platform as a full-stack developer:

- modelling the application with UML and planning the work in Jira;
- designing the MySQL database schema through Laravel migrations;
- building the Laravel back end: routes, controllers, middleware, repositories and services;
- creating the Blade interfaces with HTML, Tailwind CSS and JavaScript;
- versioning the code with Git and GitHub.

## Key features

**For clients**

- Browse a public catalogue of available services, with keyword search and category and price filters.
- Book a service for a chosen date and time, with optional notes.
- Follow and cancel reservations.
- Pay for a reservation online with PayPal.

**For service providers**

- Set up a provider profile.
- Create, edit and delete services, with photos, a category, a duration and an availability status.
- Confirm or cancel incoming reservations.
- Follow activity from a dashboard with statistics.

**For administrators**

- Manage service providers and the services they publish.
- Suspend or reactivate provider accounts and services.
- View platform statistics and export them.
- Configure platform settings for security, payments and emails.

**Accounts and notifications**

- Registration with email verification and password reset.
- Sign-in with Google or Facebook through Laravel Socialite.
- Notifications when a reservation is created, confirmed or cancelled.

## Tech stack & architecture

| Layer | Technologies |
|---|---|
| Back end | Laravel (PHP) |
| Database | MySQL |
| Front end | Blade, HTML, Tailwind CSS, JavaScript |
| Integrations | PayPal, Google and Facebook sign-in (Laravel Socialite) |
| Design & project management | UML, Jira, Git, GitHub |

Réservez-Moi follows Laravel's MVC structure, with extra layers that keep business logic out of the controllers:

- **Repositories**, behind interfaces bound in a service provider, handle data access for services and reservations.
- **Service classes** hold the business logic, such as creating a reservation and processing PayPal payments.
- **Middleware** restricts each area of the platform to the right role: client, service provider or administrator.
- **Form requests** validate input before it reaches the controllers.

## Approach

The platform is organized around three roles, each with its own routes and dashboard, so that every user only sees the actions that concern them. Reservation and payment logic lives in dedicated service classes rather than in controllers, with the aim of keeping controllers thin and the business rules in one place.

## Links

- Source code: [github.com/keltoummalouki/Reservez-Moi](https://github.com/keltoummalouki/Reservez-Moi)
- More case studies: [All projects](/en/projects)
- Need a booking platform? [Work with me](/en/freelance)$cs$
where body_markdown is null
  and locale = 'en'
  and project_id = (select id from public.projects where slug = 'reservez-moi');

update public.project_translations
set body_markdown = $cs$## نظرة عامة

Réservez-Moi منصة ويب لحجز الخدمات طوّرتها كلثوم ملوكي (Keltoum Malouki)، مطورة ويب متكاملة مقيمة في الدار البيضاء بالمغرب، باستخدام Laravel وMySQL. تربط المنصة بين العملاء ومقدّمي الخدمات: يعثر العملاء على خدمة متاحة ويحجزونها، بينما يدير مقدّمو الخدمات خدماتهم وتوفّرها وحجوزاتهم من لوحة تحكم مخصّصة.

## المشكلة

كثيراً ما يتطلّب حجز خدمة الاتصال بمقدّمها أو مراسلته ثم انتظار ردّه، في حين يتابع مقدّمو الخدمات حجوزاتهم يدوياً. تجمع Réservez-Moi كتالوج الخدمات والتوفّر والحجوزات والدفع الإلكتروني في منصة ويب واحدة، مع مساحة مخصّصة لكل نوع من المستخدمين.

## دوري

طوّرت المنصة بصفتي مطورة ويب متكاملة:

- نمذجة التطبيق باستخدام UML وتخطيط العمل في Jira؛
- تصميم مخطط قاعدة بيانات MySQL عبر ترحيلات (Migrations) Laravel؛
- تطوير الواجهة الخلفية بـ Laravel: المسارات، والمتحكّمات، والبرمجيات الوسيطة (Middleware)، والمستودعات (Repositories)، والخدمات؛
- إنشاء واجهات Blade باستخدام HTML وTailwind CSS وJavaScript؛
- إدارة الإصدارات باستخدام Git وGitHub.

## الميزات الرئيسية

**للعملاء**

- تصفّح كتالوج عام للخدمات المتاحة، مع البحث بالكلمات المفتاحية والتصفية حسب الفئة والسعر.
- حجز خدمة في التاريخ والوقت المختارين، مع إمكانية إضافة ملاحظات.
- متابعة الحجوزات وإلغاؤها.
- دفع قيمة الحجز إلكترونياً عبر PayPal.

**لمقدّمي الخدمات**

- إعداد ملف تعريفي لمقدّم الخدمة.
- إنشاء الخدمات وتعديلها وحذفها، مع الصور والفئة والمدة وحالة التوفّر.
- تأكيد الحجوزات الواردة أو إلغاؤها.
- متابعة النشاط من لوحة تحكم تتضمّن إحصائيات.

**للمسؤولين**

- إدارة مقدّمي الخدمات والخدمات التي ينشرونها.
- تعليق حسابات مقدّمي الخدمات والخدمات أو إعادة تفعيلها.
- الاطلاع على إحصائيات المنصة وتصديرها.
- ضبط إعدادات الأمان والدفع والبريد الإلكتروني.

**الحسابات والإشعارات**

- التسجيل مع التحقق من البريد الإلكتروني وإعادة تعيين كلمة المرور.
- تسجيل الدخول عبر Google أو Facebook باستخدام Laravel Socialite.
- إشعارات عند إنشاء حجز أو تأكيده أو إلغائه.

## التقنيات والبنية

| الطبقة | التقنيات |
|---|---|
| الواجهة الخلفية | Laravel (PHP) |
| قاعدة البيانات | MySQL |
| الواجهة الأمامية | Blade، HTML، Tailwind CSS، JavaScript |
| التكاملات | PayPal، تسجيل الدخول عبر Google وFacebook (Laravel Socialite) |
| التصميم وإدارة المشروع | UML، Jira، Git، GitHub |

تتبع Réservez-Moi بنية MVC في Laravel، مع طبقات إضافية تُبقي منطق الأعمال خارج المتحكّمات:

- **المستودعات (Repositories)**، خلف واجهات مربوطة في مزوّد خدمة (Service Provider)، تتولّى الوصول إلى بيانات الخدمات والحجوزات؛
- **أصناف الخدمات (Services)** تحمل منطق الأعمال، مثل إنشاء الحجز ومعالجة مدفوعات PayPal؛
- **البرمجيات الوسيطة (Middleware)** تقصر كل قسم من المنصة على الدور المناسب: عميل أو مقدّم خدمة أو مسؤول؛
- **طلبات النماذج (Form Requests)** تتحقق من المدخلات قبل وصولها إلى المتحكّمات.

## المنهجية

تُنظَّم المنصة حول ثلاثة أدوار، لكل منها مساراته ولوحة تحكمه، بحيث لا يرى كل مستخدم إلا الإجراءات التي تخصّه. ويوجد منطق الحجز والدفع في أصناف خدمات مخصّصة بدلاً من المتحكّمات، بهدف إبقاء المتحكّمات خفيفة وتجميع قواعد الأعمال في مكان واحد.

## روابط

- الشيفرة المصدرية: [github.com/keltoummalouki/Reservez-Moi](https://github.com/keltoummalouki/Reservez-Moi)
- دراسات حالة أخرى: [جميع المشاريع](/ar/projects)
- هل تحتاج إلى منصة حجز؟ [لنعمل معاً](/ar/freelance)$cs$
where body_markdown is null
  and locale = 'ar'
  and project_id = (select id from public.projects where slug = 'reservez-moi');

-- ---------------------------------------------------------------------------
-- Services (generic, evidence-based offerings; titles/descriptions per locale)
-- ---------------------------------------------------------------------------

insert into public.services (id, slug, status, sort_order, icon, title, description)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'full-stack-web-development',
    'published', 0, 'code',
    '{"fr": "Développement web full-stack", "en": "Full-stack web development", "ar": "تطوير الويب المتكامل"}'::jsonb,
    '{"fr": "Conception et développement d''applications web modernes, du frontend à la base de données.", "en": "Design and build of modern web applications, from frontend to database.", "ar": "تصميم وبناء تطبيقات ويب حديثة، من الواجهة الأمامية إلى قاعدة البيانات."}'::jsonb
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'backend-and-api-development',
    'published', 1, 'server',
    '{"fr": "Développement backend & API", "en": "Backend & API development", "ar": "تطوير الخلفية وواجهات البرمجة"}'::jsonb,
    '{"fr": "APIs REST/GraphQL robustes, modélisation de données et intégrations côté serveur.", "en": "Robust REST/GraphQL APIs, data modelling, and server-side integrations.", "ar": "واجهات برمجة REST/GraphQL موثوقة، ونمذجة البيانات، وتكاملات من جانب الخادم."}'::jsonb
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Site settings (singleton). Only public, already-displayed information.
-- ---------------------------------------------------------------------------

insert into public.site_settings (id, availability_status, contact_email, cv_url, location, social_links, profile)
values
  (
    true,
    'available',
    'keltoummalouki@gmail.com',
    '/cv.pdf',
    '{"fr": "Casablanca (mobilité / relocation)", "en": "Casablanca (mobile / relocation)", "ar": "الدار البيضاء (تنقل / انتقال)"}'::jsonb,
    '{"github": "https://github.com/keltoummalouki"}'::jsonb,
    '{
      "location": {
        "fr": "Casablanca (mobilité / relocation)",
        "en": "Casablanca (mobile / relocation)",
        "ar": "الدار البيضاء (تنقل / انتقال)"
      },
      "cvUrls": {
        "fr": "/cv.pdf",
        "en": "/cv.pdf"
      }
    }'::jsonb
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CMS expansion seed (safe subset from the existing static content).
-- Bulk content (individual skills, experiences, education, certifications) is
-- entered via the dashboard once its UI ships — deferred on purpose.
-- ---------------------------------------------------------------------------

-- About profile (singleton). Text mirrors messages/*.json `about`.
insert into public.about_profile (id, full_name, avatar_url, headline, bio)
values (
  true,
  'Keltoum Malouki',
  null,
  '{"fr": "Développeuse Web Full Stack", "en": "Full Stack Web Developer", "ar": "مطورة ويب متكاملة"}'::jsonb,
  '{"fr": "Je suis Keltoum Malouki, développeuse web full stack basée à Casablanca, Maroc. Formée chez YouCode (UM6P), je livre des solutions web complètes, de l''interface utilisateur à l''architecture back-end. Je privilégie le code propre, l''expérience utilisateur et l''apprentissage continu.", "en": "I''m Keltoum Malouki, a Full Stack Web Developer from Casablanca, Morocco. With hands-on training at YouCode (UM6P), I deliver complete web solutions from front-end interfaces to back-end architecture. I care about clean code, user experience, and continuous learning.", "ar": "أنا كلثوم ملوكي، مطورة ويب متكاملة من الدار البيضاء، المغرب. تلقيت تدريباً عملياً في YouCode (UM6P)، وأقدم حلولاً ويب متكاملة من واجهات المستخدم إلى البنية التحتية الخلفية. أهتم بالبرمجية النظيفة وتجربة المستخدم والتعلم المستمر."}'::jsonb
)
on conflict (id) do nothing;

-- Design settings (singleton): sensible defaults matching the current site.
insert into public.design_settings (
  id,
  default_locale,
  default_theme,
  font_body,
  font_heading,
  cursor_style,
  header_position,
  nav_items
)
values (
  true,
  'fr',
  'dark',
  'space-grotesk',
  'archivo',
  'default',
  'bottom',
  '["about","experience","projects","blog","freelance","contact"]'::jsonb
)
on conflict (id) do nothing;

-- Social links (mirrors the footer).
insert into public.social_links (platform, url, sort_order, status)
values
  ('github', 'https://github.com/keltoummalouki', 0, 'published'),
  ('linkedin', 'https://www.linkedin.com/in/keltoummalouki', 1, 'published'),
  ('email', 'mailto:keltoummalouki@gmail.com', 2, 'published')
on conflict do nothing;

-- Spoken languages shown in the About section.
insert into public.languages (id, name, level, icon, sort_order, status)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '{"fr": "Arabe", "en": "Arabic", "ar": "العربية"}'::jsonb,
    '{"fr": "Maternelle", "en": "Native", "ar": "اللغة الأم"}'::jsonb,
    'globe',
    0,
    'published'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '{"fr": "Français", "en": "French", "ar": "الفرنسية"}'::jsonb,
    '{"fr": "B1", "en": "B1", "ar": "B1"}'::jsonb,
    'globe',
    1,
    'published'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '{"fr": "Anglais", "en": "English", "ar": "الإنجليزية"}'::jsonb,
    '{"fr": "A2", "en": "A2", "ar": "A2"}'::jsonb,
    'globe',
    2,
    'published'
  )
on conflict (id) do nothing;

-- Skill categories (mirrors messages/*.json `skills.categories`).
insert into public.skill_categories (slug, name, sort_order)
values
  ('languages', '{"fr": "Langages", "en": "Languages", "ar": "لغات البرمجة"}'::jsonb, 0),
  ('frameworks', '{"fr": "Frameworks & APIs", "en": "Frameworks & APIs", "ar": "الأطر وواجهات البرمجة"}'::jsonb, 1),
  ('devops', '{"fr": "DevOps", "en": "DevOps", "ar": "DevOps"}'::jsonb, 2),
  ('databases', '{"fr": "Bases de données", "en": "Databases", "ar": "قواعد البيانات"}'::jsonb, 3),
  ('management', '{"fr": "Gestion de projets", "en": "Project Management", "ar": "إدارة المشاريع"}'::jsonb, 4),
  ('modeling', '{"fr": "Conception & Modélisation", "en": "Design & Modeling", "ar": "التصميم والنمذجة"}'::jsonb, 5),
  ('versioning', '{"fr": "Contrôle de version", "en": "Version Control", "ar": "التحكم بالإصدارات"}'::jsonb, 6),
  ('design', '{"fr": "UX/UI Design", "en": "UX/UI Design", "ar": "تصميم UX/UI"}'::jsonb, 7)
on conflict (slug) do nothing;

-- Technical skills + soft skills (mirrors the public skills/soft-skills cards).
with skill_seed(category_slug, skill_type, name, icon, sort_order) as (
  values
    ('languages', 'technical', 'C', 'C', 0),
    ('languages', 'technical', 'HTML5', 'HTML5', 1),
    ('languages', 'technical', 'CSS3', 'CSS3', 2),
    ('languages', 'technical', 'SQL', 'SQL', 3),
    ('languages', 'technical', 'NoSQL', 'NoSQL', 4),
    ('languages', 'technical', 'JavaScript', 'JavaScript', 5),
    ('languages', 'technical', 'TypeScript', 'TypeScript', 6),
    ('languages', 'technical', 'PHP', 'PHP', 7),
    ('frameworks', 'technical', 'Laravel', 'Laravel', 0),
    ('frameworks', 'technical', 'Node.js', 'Node.js', 1),
    ('frameworks', 'technical', 'React', 'React', 2),
    ('frameworks', 'technical', 'Next.js', 'Next.js', 3),
    ('frameworks', 'technical', 'Express.js', 'Express.js', 4),
    ('frameworks', 'technical', 'NestJS', 'NestJS', 5),
    ('frameworks', 'technical', 'Ruby on Rails', 'Ruby on Rails', 6),
    ('frameworks', 'technical', 'Angular', 'Angular', 7),
    ('frameworks', 'technical', 'Tailwind CSS', 'Tailwind CSS', 8),
    ('frameworks', 'technical', 'GraphQL', 'GraphQL', 9),
    ('devops', 'technical', 'Docker', 'Docker', 0),
    ('devops', 'technical', 'CI/CD', 'CI/CD', 1),
    ('devops', 'technical', 'GitLab', 'GitLab', 2),
    ('databases', 'technical', 'MySQL', 'MySQL', 0),
    ('databases', 'technical', 'PostgreSQL', 'PostgreSQL', 1),
    ('databases', 'technical', 'MongoDB', 'MongoDB', 2),
    ('management', 'technical', 'Agile', '', 0),
    ('management', 'technical', 'Jira', 'Jira', 1),
    ('modeling', 'technical', 'Merise', '', 0),
    ('modeling', 'technical', 'UML', '', 1),
    ('versioning', 'technical', 'Git', 'Git', 0),
    ('versioning', 'technical', 'GitHub', 'GitHub', 1),
    ('versioning', 'technical', 'GitLab', 'GitLab', 2),
    ('design', 'technical', 'Figma', 'Figma', 0),
    ('design', 'technical', 'Canva', 'Canva', 1),
    ('design', 'technical', 'Adobe XD', 'Adobe XD', 2),
    (null, 'soft', 'Time Management', 'clock', 0),
    (null, 'soft', 'Adaptability / Flexibility', 'rotate', 1),
    (null, 'soft', 'Teamwork', 'handshake', 2)
)
insert into public.skills (category_id, skill_type, name, icon, sort_order, status)
select
  c.id,
  s.skill_type,
  s.name,
  nullif(s.icon, ''),
  s.sort_order,
  'published'
from skill_seed s
left join public.skill_categories c on c.slug = s.category_slug
where not exists (
  select 1
  from public.skills existing
  where lower(existing.name) = lower(s.name)
    and existing.skill_type = s.skill_type
);

-- Experience items (mirrors the public timeline, with stack/technologies).
insert into public.experiences (
  id,
  company,
  location,
  start_date,
  end_date,
  is_current,
  sort_order,
  status,
  technologies
)
values
  (
    '55555555-5555-4555-8555-555555555555',
    'DabaDoc',
    'Casablanca, Morocco',
    '2026-02-01',
    null,
    true,
    0,
    'published',
    array['Ruby on Rails', 'Angular', 'CoffeeScript', 'MongoDB', 'Docker', 'Git/GitHub']
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Caisse Manager',
    'Rabat, Morocco',
    '2025-06-01',
    '2025-08-31',
    false,
    1,
    'published',
    array['Next.js', 'React', 'Tailwind CSS', 'GSAP', 'Framer Motion', 'Git/GitHub']
  )
on conflict (id) do nothing;

insert into public.experience_translations (experience_id, locale, role, description)
values
  (
    '55555555-5555-4555-8555-555555555555',
    'fr',
    'Développeuse Full Stack',
    'Développement et maintenance de fonctionnalités pour une plateforme médicale de prise de rendez-vous. Amélioration de l''interface utilisateur et de l''expérience produit.'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'en',
    'Full Stack Developer',
    'Develop and maintain features for a medical appointment-booking platform. Improve UI and user experience across the product.'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'ar',
    'مطورة ويب متكاملة',
    'تطوير وصيانة ميزات لمنصة طبية لحجز المواعيد، مع تحسين الواجهة وتجربة المستخدم.'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'fr',
    'Stagiaire Développeuse Web',
    'Création d''un site vitrine et intégration d''interfaces front-end pour des outils de gestion financière.'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'en',
    'Web Developer Intern',
    'Built a showcase site and integrated front-end interfaces for financial management tools.'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'ar',
    'متدربة تطوير ويب',
    'بناء موقع تعريفي ودمج واجهات أمامية لأدوات إدارة مالية.'
  )
on conflict (experience_id, locale) do nothing;
