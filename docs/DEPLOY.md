# Deployment Flow

## خطة Hostinger المستقلة — 16 أكتوبر 2026

CMS هو تطبيق Next.js/Payload مستقل على Hostinger، ومستودعه `futurerotech/healthylifestyles-cms`. الواجهة Astro من مستودع `futurerotech/HealthyLifestyles` على Vercel؛ تتصل به عبر HTTPS. الهدف الأول إصدار صلاحيات pSEO على Hostinger وحده، ثم التحقق والبناء المحلي، ثم إصدار Vercel بموافقة منفصلة. **هذه خطة معلّقة؛ لم يُنفذ رفع أو دمج أو نشر أو ترحيل أو تغيير إعدادات استضافة.**

**تأكيد المالك من hPanel:** الخطة Cloud Startup، والتطبيق Node.js/Next.js مُدار، والمستودع `futurerotech/healthylifestyles-cms`، وفرع النشر `main`، وNode.js 22.x، والنشر التلقائي مفعّل، وSSH متاح. هذه إعدادات مؤكدة من المالك؛ لم تُفحص اللوحة مباشرة من هذه الجلسة. أوامر البناء والتشغيل الفعلية وSHA المنشور ومزود DB والتخزين ما زالت بحاجة إلى التحقق. لا توجد خطة VPS لهذا المشروع.

**تحقق GitHub الحي، 16 أكتوبر:** المستودع عام وفرعه الافتراضي `main`. استعلام الفرع يعيد `protected:false` وقائمة Rulesets العامة فارغة؛ لذلك لا يوجد دليل على فرض بوابة مراجعة على main. workflow `Promote dev → main` حالته active. آخر SHA لـmain هو `b508b0dc3e751c276155468ebf55225522d84bbd`، وdev هو `1ba875407bdfcda996d4fc311540593d73b0b2db`؛ مقارنة GitHub تؤكد أن dev متأخر 7 commits وليس متقدماً. فُحص workflow الموجود على main مباشرة، وهو يرقّي push dev بعد نجاح CI، لكنه لا يشغّل npm test أو npm audit. آخر تشغيلين ظاهرين لـPR قديم نجحا؛ هذا لا يثبت سلامة الرقعة الجديدة أو حماية الفرع. API تفاصيل الحماية وWebhooks أعاد 401 لغياب المصادقة، لذا لا يُدّعى فحص إعدادات الإدارة أو delivery history.

### دليل الإعداد الفعلي وحدود التحقق

| البند | النتيجة المثبتة محلياً | المطلوب قبل الإصدار |
| --- | --- | --- |
| GitHub Actions | workflow حي active، ومساره push dev ثم ترقية main؛ main يظهر غير محمي وdev متأخر 7 commits | اعتماد مسار مراجعة يمنع main غير المفحوص، وتسوية تأخر dev بموافقة منفصلة قبل استخدام الترقية |
| Hostinger | تأكيد المالك: Cloud Startup، تطبيق مُدار، GitHub CMS/main، Node 22.x، auto-deploy مفعّل | مطابقة SHA الحي وآخر delivery وإصدار ناجح، وأوامر البناء والتشغيل وسجلاتهما |
| البناء | `npm run build`: تنظيف `.next` ثم domain check وimportmap وNext build؛ لا يشغّل migrate | تأكيد ألا تضيف إعدادات hPanel أو hook خارجي migrate/seed/import أو أوامر أخرى |
| التشغيل | `npm run start` = `next start -p 3000` | تأكيد الأمر الفعلي والمجلد والمنفذ لدى المضيف؛ المنفذ في الكود ليس إذناً لتغييره |
| قاعدة البيانات | `postgresAdapter` يستخدم `DATABASE_URI`، و`push` لا يُفعّل إلا بـ`ALLOW_DB_PUSH=true`؛ `prodMigrations` غير ممرر | تحديد مزود قاعدة الإنتاج من إعداد Hostinger دون نسخ URI، ومراجعة migrations المطبقة قراءةً فقط |
| اختلاف المحلي عن الإنتاج | `.env` المحلي يشير إلى Neon؛ متغيرات S3 وVercel hook غير مضبوطة فيه | هذا لا يثبت أن الإنتاج على Neon أو يفتقد التخزين/الـhook؛ تعليقات الكود التي تذكر Supabase ليست دليلاً حياً |
| الوسائط | S3/R2 اختياري؛ بدونه يستخدم CMS مجلد `media` المحلي | تحديد موقع ملفات الإنتاج الفعلي واستمراريتها؛ لا تبدّل bucket أو public URL أو مسارات الصور أثناء هذا الإصدار |

مرجع `origin/main` المحلي يطابق main الذي قُرئ حياً الآن، لكنه ليس إثباتاً لـSHA Hostinger المنشور. الفرع المحلي يحتوي أعمالاً أوسع؛ لا تُصدره كاملاً باسم إصلاح 403. لم توجد جلسة Hostinger/Vercel مصادقة متاحة؛ يلزم التحقق من القيم المتبقية قبل تحويل الخطة إلى خطوات تنفيذ نهائية. لا تُقرأ ملفات النسخ المحلية القديمة بوصفها إعدادات حية أو نسخاً موثوقة حديثة، ولا تُرفع إلى Git.

في تطبيق Node.js المُدار: Hostinger يدير العملية، وتوجد إعدادات للبناء والتشغيل وإعادة التشغيل. GitHub المتصل قد ينشر تلقائياً عند رفع الكود؛ ZIP يحتاج إعادة رفع عند تغير المصدر. لا تفترض PM2 ولا تنفّذ تعليمات VPS على هذه الخدمة. [إدارة تطبيق Node.js](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)، [إعادة الإصدار ومراجعة أوامره](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/).

في هذا المشروع اعتبر تحديث main إجراء نشر مباشر لأن المالك أكد auto-deploy، حتى دون ضغط Redeploy. توفر SSH لا يحوّل الاستضافة إلى VPS: يستخدم عند الحاجة للفحص/نسخ الملفات المصرح به فقط، ولا نعتمد عليه لإدارة Node أو تعديل المخرج الحي. توثيق Hostinger يذكر أن npm تديره المنصة في Cloud/Business وأن التعديلات اليدوية عبر SSH على ملفات الإصدار تُستبدل لاحقاً. قد تكون الملفات تحت `hbuilds/current/nodejs` أو البنية القديمة `nodejs`؛ تحقق من المسار الفعلي ولا تحذف أو تبدّل symlinks. لا تُخلط استجابة Payload JSON 403 المثبتة مع 403 عام في توجيه .htaccess؛ لا نعدّل التوجيه لهذا الإصلاح.

مسار العمل لهذا المشروع داخل hPanel: Websites → تطبيق CMS القائم → Dashboard/Deployments، لقراءة تفاصيل الإصدار والسجل، ومراجعة إعدادات البناء والتشغيل وأسماء المتغيرات دون حفظ أو Redeploy. لا تُطبق تعليمات SSH أو PM2 أو systemd أو تبديل مجلدات VPS. إعادة تشغيل العملية وحدها لا تجلب رقعة الكود ولا تعوض إصداراً جديداً.

### فصل CMS عن إعادة بناء Vercel

المسار النشط في الكود المفحوص هو زر مدير → `POST /api/deploy` → `VERCEL_DEPLOY_HOOK_URL` من الخادم. الحماية تعتمد على جلسة المدير وOrigin والمهلة بين الطلبات. لا تُطبع قيمة المتغير ولا يُستدعى الـhook للاختبار: استدعاؤه إصدار فعلي. [توثيق Vercel](https://vercel.com/docs/deploy-hooks) يوضح أن رابط Deploy Hook يطلق البناء ويحدد المشروع والفرع.

تسجيل تغييرات المحتوى في pending لا يساوي إرسال Webhook. `triggerVercelDeploy.ts` القديم في المرجع المحلي غير مستورد من كود نشط؛ الفرع الحالي أزاله. لم يُعثر على استدعاء Deploy Hook عند بدء التطبيق أو اكتمال بناء CMS. لكن ذلك لا ينفي أتمتة خارج المستودع أو كوداً أقدم في الإنتاج: راجع نسخة Hostinger الفعلية وGitHub Webhooks/Apps وVercel Deploy Hooks وسجل آخر الإصدارات وcron/n8n. قارِن توقيت وSHA إصدار CMS مع مصدر حدث Vercel لتحديد السبب. لا تضغط زر النشر ولا تعِد ربط GitHub أو تغيّر المستودع، فقد يبدأ إصدار بمجرد الربط.

قبل أي إصدار CMS، يجب إثبات عدم وجود مشغّل خارجي يعيد بناء Astro تلقائياً. إن وُجد مشغّل يلزم تغييره لعزل الإصدار، يُعرض التغيير المحدد للموافقة أولاً؛ لا نوقف فحص الأمان أو نُغيّر إعدادات المضيف تلقائياً. منفصلان في الاستضافة لا يعنيان استقلال جميع المشغّلات.

### حزمة إصلاح 403 الصغيرة

1. حدد SHA الحي أولاً، ثم حضّر في نسخة عمل معزولة رقعة متوافقة معه، مع إبقاء كل إصلاحات `codex/seo-cms-sync` محفوظة. لا تنفذ cherry-pick أو merge الآن. لا تشمل الرقعة تغييرات schema أو تحديث إطار العمل أو ترحيلات auth/media/unique routes أو إعادة تنظيم طابور النشر.
2. أدرج سياسة القراءة فقط: المدير يستطيع القراءة؛ سواه مقيد بـ`status=published` حتى لو أرسل شرط مسودات أو شرط OR. امنع قراءة `template` و`dataset` و`keyword` و`variables` عبر field access. لا يكفي إخفاؤها في واجهة الإدارة أو الاعتماد على select من Astro. الإنشاء والتعديل والحذف والتوليد للمدير؛ لا تمنح Astro مفتاح مدير.
3. انقل اختبارات السياسة وملاءمتها مع collection الموجودة على SHA الحي. لا تنقل ملف PseoPages الحالي كاملاً بلا مراجعة، لأنه يتضمن hooks من أعمال المزامنة الأوسع. اختبر REST list وby-ID وdepth/select ومطالبة المسودات وغياب حقول التوليد، مع مدير ومحرر وزائر، على staging معزول.
4. **أثر جانبي يمنع حالياً ضمان عدم الكتابة:** `payload.config.ts:onInit` ينشئ أربعة `outreach-templates` إذا كانت المجموعة فارغة؛ يوجد في المرجع والفرع المحلي. يمكن استدعاء تهيئة Payload أثناء البناء أو التشغيل. قبل الإصدار يجب إعداد تغيير صغير يمنع seeding افتراضياً في الإنتاج، واختباره على مجموعة فارغة وعلى مجموعة بها بيانات. هذا التغيير لم يُنفذ في جولة تحديث الخطة. عدم تشغيل migrate لا يمنع وحده كتابة onInit. لا تختبر الفراغ بحذف سجلات إنتاج.
5. اشترط `ALLOW_DB_PUSH=false` وعدم تمرير prodMigrations، وعدم وجود seed/import/reset في تعليمات المضيف، وثبات إعدادات DB والتخزين والسر. لا تُشغّل `payload migrate` أو `seo:audit-fix` أو أدوات recovery على الإنتاج. راجع صلاحيات حساب البناء؛ إن احتاج read-only مؤقتاً فذلك تغيير إعداد/صلاحية مستقل يحتاج اعتماداً، ولا يُستبدل حساب تشغيل CMS الذي يحتاج عمليات التحرير المعتادة.

### نسخ احتياطي وتجربة التراجع قبل الموافقة

1. سجّل baseline عام حديثاً للمقالات والأدوات والصفحات (ID/slug/title/dates/SEO/العلاقات والصور)، وجرد pSEO كامل من حساب مصرح به أو نسخة staging بما أن القراءة العامة تعيد 403. لا تضع المسودات أو البيانات الشخصية أو الأسرار في تقرير عام. الأعداد المرجعية العامة الحالية: 39 مقالاً، 70 أداة مفعلة تقابل 68 صفحة وتحويلين، و0 pages؛ عدد pSEO غير معلوم.
2. حدّد مزود قاعدة الإنتاج الحقيقي، ثم خطط لقطة متسقة/نسخة PostgreSQL عبر المزود أو pg_dump بصلاحية نسخ مناسبة دون كتابة المحتوى. سجّل توقيت اللقطة وحجمها وchecksum وتشفيرها واحتفاظها في مكان مستقل. النسخ الفعلي لم يُنفذ الآن. backup ملفات Hostinger وحده لا يضمن نسخ PostgreSQL خارجي أو bucket.
3. انسخ الوسائط من المخزن الفعلي مع مفاتيح الملفات/إصداراتها وخرائط URLs، واحتفظ بإعدادات التشغيل ونسخة الكود/lockfile وSHA وإصدار Node السابق في مخزن آمن؛ التقرير يذكر أسماء المتغيرات وحالة التحقق فقط. لا تفترض أن مجلد media داخل تطبيق يُستبدل عند الإصدار دائم التخزين. لا تنقل الوسائط إلى مزود آخر في رقعة 403.
4. جرّب استعادة النسخة إلى قاعدة منفصلة تماماً، مع تعطيل/حجب اتصالات Vercel وIndexNow وn8n والبريد وWeb Push، وأسرار اختبار ووسائط معزولة. تحقق من IDs والأعداد وبصمات المحتوى والعلاقات والصور. فحص قائمة محتويات dump وحده لا يثبت قابلية الاستعادة. لا توجه staging إلى قاعدة الإنتاج أو تطبق seed عليها.
5. جرّب تشغيل الرقعة ثم الرجوع للكود السابق على قاعدة staging نفسها، دون تغيير schema. وثّق طريقة اختيار الإصدار السابق المتاحة فعلاً في Hostinger. زر Redeploy قد يجلب أحدث commit من الفرع، ولذلك ليس بالضرورة rollback؛ لا تفترض وجود زر تراجع محفوظ. جهّز المصدر السابق المعروف الصالح ومسار نشره المعتمد إذا لم تتوفر استعادة artifact سابق.

### تسلسل إصدار Hostinger بعد موافقة صريحة فقط

1. لا تبدأ قبل نجاح أمان حزمة CMS الفعلية، واختبارات الصلاحيات، وTypeScript، وdomain guard، وبناء معزول، ثم اختبار تكاملي على نسخة DB staging الموثقة واختبار عدم الكتابة عند init. الاختبارات السابقة للفرع الأوسع (78 اختباراً وبناء معزول) لا تعوض هذه الاختبارات للحزمة الصغيرة على SHA الحي.
2. سجّل إصدار Vercel القائم وmanifest وSitemap وعينات الصور والواجهات التابعة لـCMS قبل الإصدار؛ احتفظ به قائماً. اتفق على نافذة قصيرة لتجنب تغييرات تحريرية متزامنة. إعادة تشغيل CMS قد تؤثر مؤقتاً في الإدارة والاشتراك/الطلبات الديناميكية التي تتصل به، حتى لو بقي HTML الموقع على Vercel متاحاً؛ لا نضمن انعدام الأثر مطلقاً.
3. **المسار المؤكد GitHub/main→Hostinger آلياً:** لا تغيير main قبل اعتماد رقعة محددة وSHA والنسخة الاحتياطية ومسار التراجع، واستكمال فحوص الأمان والصلاحيات والبناء. لا تستخدم push dev الآن؛ dev متأخر وworkflow قد يرقّي أعمالاً أخرى بعد تسوية تاريخه. يُخطط لمسار مراجعة الرقعة وفرض الفحوص أولاً؛ إضافة حماية main أو تغيير workflow أو دمج/مزامنة dev يحتاج موافقة ولا يُنفذ ضمن الاستقصاء. الموافقة النهائية يجب أن تغطي السلسلة الآلية كاملة، وليس Push بوصفه حفظ كود فقط. يُصدر CMS وحده، ويُراقب SHA وسجل Hostinger؛ لا يُرفع Astro ولا يُستدعى Webhook.
4. **hPanel للمراجعة والمراقبة والتراجع المعتمد:** افتح تطبيق CMS القائم → Deployments لقراءة حالة البناء وSHA والسجل. تحقق من Node 22.x وأوامر البناء والتشغيل والقيم الموجودة دون كشفها. لا تضغط Redeploy إضافياً بعد حدث GitHub فتُنشئ بناءً ثانياً. لا تنشئ موقعاً بديلاً ولا تحذف الموقع ولا تُغيّر المستودع. لمشروع Next الحالي ناتج البناء `.next` وليس `out`، والتشغيل يحتاج Node دائم. راجع الأمر الفعلي لدى المضيف قبل اعتماده.
5. **تشغيل التطبيق المُدار:** اترك إدارة Node.js والبناء وتفعيل المخرج لـhPanel، بالأوامر المعتمدة بعد التحقق. لا تنفذ تثبيتاً أو بناءً يدوياً عبر SSH ولا تثبّت مدير عمليات. لا تستخدم Restart لاختبار الإعدادات قبل الموافقة؛ يمكن أن يعيد تهيئة Payload ويشغّل onInit. راقب سجلات الإصدار وحالة Running والموارد بعد الإصدار المعتمد.
6. تحقق من حالة العملية ومن السجل دون تسريب الأسرار، وAPI عام منشور 200، وقيود المسودات/حقول التوليد، وتطابق inventory كاملاً عبر pagination. تحقق من بقاء 39 مقالاً و70 سجل أدوات و56 FAQ وصورها وIDs وتواريخها وSEO وعلاقاتها بلا تغير غير مراجع. لا تنشئ سجلات أو تحفظ مقالات أو تستدعِ مولد pSEO في الإنتاج لاختبار الصلاحيات.
7. تأكد أن Vercel deployment ID لم يتغير ولم يصله حدث Webhook، وأن الموقع وواجهاته تعمل. بعد نجاح هذه المرحلة انتقل إلى جرد pSEO/baseline والبناء المحلي المباشر وفحوص Sitemap وCanonical، وفق [دليل الواجهة](../../docs/DEPLOY.md). إصدار Vercel يحتاج موافقة مستقلة.

### تراجع CMS دون استرجاع قاعدة الإنتاج

مسببات التراجع: فشل بدء التطبيق، أخطاء API أو الصور، تغير المحتوى، ظهور مسودات/حقول خاصة، أو تراجع الوظائف الأساسية. أعد الكود/المخرج السابق المعروف الصالح بالطريقة التي اختُبرت وبنفس DB والوسائط والأسرار؛ لا تعِد snapshot قاعدة الإنتاج لمجرد التراجع عن صلاحية قراءة. الاسترجاع قد يمحو تحريراً أو اشتراكات أحدث ويحتاج خطة وموافقة منفصلة. عودة 403 بعد الرجوع للنسخة القديمة متوقعة؛ يبقى بناء Astro محظوراً، ولا نستخدم fallback لتخطيها. تراجع الكود نفسه يعيد تشغيل CMS وقد يستدعي onInit القديم، لذلك يجب أن تشمل تجربة التراجع هذا الأثر أيضاً. لا force-push أو تعديل تاريخ Git.

سجّل قبل النشر deployment ID السابق وSHA ووسيلة استعادته المتاحة فعلاً في hPanel. إن وفرت اللوحة تراجعاً إلى المخرج السابق فاختبره في staging ثم استخدمه بعد اعتماد التراجع. إن لم توفره، حضّر مسبقاً revert يقتصر على رقعة الإصدار عبر مسار المراجعة الموافق عليه؛ تحديث main الناتج ينشّط النشر الآلي. Redeploy لأحدث main لا يسترجع الكود القديم. لا تغيّر `hbuilds/current` يدوياً ولا تفترض بقاء نسخ المضيف إلى أجل غير محدود؛ توثيق البنية الجديدة يذكر الاحتفاظ بآخر نسختين ناجحتين، لذلك احفظ مصدراً مستقلاً للإصدار السابق. فشل البناء قد يُبقي المخرج السابق، لكنه لا يعكس أي كتابة جانبية حدثت أثناء init.

### الأمان وقرار الإصدار

تدقيق lockfile المحلي بتاريخ 16 أكتوبر: CMS **30** نتيجة (2 حرجة، 13 عالية، 12 متوسطة، 3 منخفضة)؛ دون dev: **25** (0 حرجة، 12 عالية، 10 متوسطة، 3 منخفضة). الحرجتان في أدوات Vitest/Tinypool، لكن مخاطر التشغيل العالية ما زالت قائمة؛ استبعاد dev لا يجيز الإصدار. هذه أعداد حزم وقد تشترك في أصل الثغرة، ولا تثبت اعتماديات الخادم الحي. تقارير التدقيق محفوظة في `../../docs/seo/security-audit-cms-20261016.json` و`security-audit-cms-runtime-20261016.json`. الواجهة لها تقرير مستقل من ست نتائج وتبقى ترقيتها الكبرى منفصلة.

workflow CMS الحالي يفحص الأنواع ويبني ويختبر الترحيلات على PostgreSQL مؤقت في CI؛ هذه ليست ترحيلات إنتاج. لكنه لا يشغّل `npm test` أو `npm audit`؛ يجب إدخالهما كشرط إصدار إلزامي للحزمة المستهدفة. كذلك يستخدم اتصال PostgreSQL البعيد `rejectUnauthorized:false`؛ يلزم مراجعة سلسلة CA وإثبات TLS صحيح في عمل مدروس قبل اعتبار حماية الاتصال مكتملة، دون تغيير مفاجئ يقطع قاعدة الإنتاج. افحص التخزين الدائم وروابط الصور وحدود صلاحية عامة pSEO، ولا تفتح read لجميع السجلات أو ترفع مفتاح مدير إلى Astro.

**CMS وVercel غير جاهزين للإصدار حالياً.** خطة 403 مصدرية بلا تغيير schema، لكن عزلها على SHA Hostinger الحي، ومنع seed، واجتياز الأمان، وإثبات backup/rollback، ومراجعة غياب حماية main وتأخر dev، ومطابقة أوامر المضيف ومشغلات Vercel شروط لم تكتمل. أكد المالك بيانات الاستضافة والربط والنشر التلقائي؛ فُحص GitHub حياً قراءةً فقط. لم تُغيّر هذه الجولة كود التطبيق أو workflow أو البيئة أو قاعدة الإنتاج. لم يُنفذ أي Push/Merge/Deploy/Migration.

## Current coordinated release hold (2026-10-15)

Implementation is local on `codex/seo-cms-sync` in both repositories. No push, production migration, or deployment is authorized. The frontend major security upgrade is separate; unresolved high/critical findings remain release blockers. A push to `dev` can automatically reach production, so obtain explicit approval before pushing.

## Broader branch migration review (separate future release, superseded for the 403 patch)

The following describes the wider synchronization branch only. It is not part of the no-migration Hostinger access patch above and does not authorize any production operation.

1. Review the branches, run `npm test`, `npx tsc --noEmit`, `npm run check:domain`, and a database-isolated `npm run build:ci`. Compilation alone does not prove production migration compatibility.
2. Back up the production database and rehearse all pending migrations against a restored staging copy. Keep `ALLOW_DB_PUSH=false`; use registered migrations rather than schema push. The branch includes earlier pending auth/media migrations as well as `20261015_180000_unique_content_routes`.
3. Inspect duplicate slugs in articles, tools, pages, authors, tags, and category kind/slug pairs. The new migration refuses duplicates instead of deleting or renaming content. Resolve collisions with reviewed content edits and redirects before retrying. Its rollback deliberately preserves URL uniqueness.
4. After approval, deploy the CMS and apply reviewed migrations using the established release procedure. Verify public `pages` and `pseo-pages` reads return only published records. Confirm the deploy hook targets the intended frontend project without invoking it prematurely.
5. Deploy the frontend next using its deployment guide. Confirm the public `/content-manifest.json` identifies this CMS and contains rendered revisions. Until then the pending indicator may show verification unavailable; this must never mean the site is synchronized.
6. Rehearse publish/update/unpublish/delete/global changes in staging. Each change appends an immutable event. Requesting a build leaves events pending. The authenticated pending endpoint reconciles exact events against the deployed receipt; an older build cannot clear a newer edit.
7. Verify IndexNow is enabled only with the intended host/key. Automatic notifications occur after receipt confirmation. The manual endpoint accepts only deployed indexable URLs; it no longer calls Google's restricted Indexing API for general health pages.

Do not run a production build or migration with a placeholder database URL. The isolated build used for this review was compilation-only and did not access production data.

## Existing automatic promotion pipeline

1. All work is committed to the `dev` branch.
2. On push to `dev`, GitHub Actions runs CI:
   - `npm run check:domain` (domain spelling guard)
   - `npx tsc --noEmit` (type check)
   - `npm run build:ci` (build without DB migrations)
3. If CI passes → `main` is fast-forwarded to the `dev` commit automatically.
4. If the live Hostinger integration is enabled for this repository and `main`, it can detect the change and deploy. This must be verified in the hosting dashboard; the workflow contains no Hostinger deployment step.
5. If CI fails → `main` is untouched → live site is unaffected.

## Rules
- **NEVER push to `main` directly.** Promotion is the workflow's job only.
- Use a local review branch before release approval. Landing on `dev` starts automatic production promotion.
- Verify locally first: `npm run build:ci` (exit 0) + `npx tsc --noEmit` (0 errors).

## Rollback

With release approval, select a known-good deployment and prepare a regular revert through `dev`. Rehearse database rollback compatibility separately; do not force-push `main` or assume a code rollback reverses database migrations.

## Branch setup (one-time, already done)
- `dev` branch created from `main` head
- `.github/workflows/promote.yml` created
- Backup tag: `backup/pre-seo-2026-07`

## GitHub repo settings (requires manual login)
1. Set `dev` as the default branch: Settings → Branches → Default branch → `dev`
2. Add branch protection rule for `main`: Settings → Branches → Add rule →
   - Branch name pattern: `main`
   - Require status checks to pass: ✅
   - Required: `ci` (from promote.yml)
   - Restrict who can push: only `github-actions[bot]`
3. Inspect GitHub Apps/Webhooks and their delivery history read-only. Do not remove or reconnect an integration: the frontend legitimately uses Vercel, and any hosting-trigger change requires a separate approved plan.

<!-- PSEO_ACCESS_20261016 -->
## pSEO access release hold (2026-10-16)

The public REST pseo-pages endpoint currently returns 403. The reference configuration used admin-only reads while its public renderer used the privileged Local API with a published-status filter. Local code now uses publishedPseoRead: public/non-admin users see status=published only; drafts, generation inputs, templates and datasets remain private. Writes and the generate endpoint require an admin. Astro needs no privileged API key. These access-only changes do not add database fields or require a new migration by themselves. Earlier pending migrations remain subject to separate review and approval.

78 CMS tests and the isolated CMS compilation passed without a production database connection. The direct Astro build still fails on the deployed 403, so production pSEO counts are unknown. No deployment or migration is authorized or has been performed. After explicit approval for a CMS release, independently verify public published reads and draft/private-field denial, capture the reviewed pSEO inventory without assuming zero, then rerun the complete direct frontend build and both content and security gates. Do not push dev speculatively: it can automatically reach production.
