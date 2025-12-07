import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';

const PrivacyTerms = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-warm-start/5 blur-3xl"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <header className="relative z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/wishly logo trans.png"
              alt="Wishly"
              className="h-12 w-12 rounded-full object-cover drop-shadow-lg"
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Privacy &amp; Terms
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href="/">{t('footer.back_home', 'Back to home')}</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-10 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* English column */}
          {(!i18n.language || !i18n.language.startsWith('ar')) && (
          <section className="space-y-8 bg-card/80 backdrop-blur rounded-3xl border border-border/50 p-6 md:p-8 shadow-xl">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
                Wishly
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-primary">
                Privacy Policy &amp; Terms of Use
              </h2>
              <p className="text-xs text-muted-foreground">
                Last updated: 2025 • This page is provided for transparency and is not formal legal advice.
              </p>
            </header>

            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">1. Legal compliance &amp; jurisdiction</h3>
                <p>
                  Wishly is designed to comply with the laws of the State of Qatar, including Qatar Law No. (13) of 2016 on
                  Protecting Personal Data Privacy, as applicable. By using Wishly, you agree that these terms and any
                  disputes or legal responsibilities are governed by Qatari law and subject to the jurisdiction of the
                  competent courts in the State of Qatar, without prejudice to our right to take action in other
                  jurisdictions where appropriate.
                </p>
                <p>
                  Where we are required to cooperate with Qatari authorities or other competent authorities, we may share
                  relevant information in response to valid legal requests, in line with applicable law.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">2. What data we collect</h3>
                <p>
                  The exact data processed depends on how you use Wishly. In general, we may collect:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="font-medium">Account data</span> – such as your email address, name or username, profile
                    picture and basic settings.
                  </li>
                  <li>
                    <span className="font-medium">Wishlist &amp; social data</span> – wishlists you create, items you add,
                    reservations/claims, events, followers/following relationships and interactions with friends and brands.
                  </li>
                  <li>
                    <span className="font-medium">Messaging &amp; notifications</span> – messages you send/receive, activity
                    notifications and related metadata.
                  </li>
                  <li>
                    <span className="font-medium">Technical &amp; usage data</span> – device type, approximate region based on
                    IP, app usage patterns, logs and basic analytics used to keep the service reliable and secure.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">3. How we use your data</h3>
                <p>We generally use your data to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Provide and maintain the Wishly app and its core features (wishlists, events, social features).</li>
                  <li>Help you connect with friends and brands, and manage who can see your lists.</li>
                  <li>Secure accounts, prevent abuse and investigate suspicious or harmful activity.</li>
                  <li>Understand how Wishly is used so we can improve performance, reliability and user experience.</li>
                </ul>
                <p>
                  Depending on the context, processing may be based on your consent, our need to perform a contract with you,
                  our legitimate interests in operating a secure social wishlist service, or our need to comply with law.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">4. Sharing with service providers &amp; infrastructure</h3>
                <p>
                  To run Wishly, we rely on trusted third-party providers. In particular, we use Supabase to provide
                  authentication, databases, real-time features and file storage, and a cloud hosting provider (such as
                  Vercel or a similar service) to serve the web application.
                </p>
                <p>
                  These providers may process personal data such as your email address, profile details, wishlists and
                  interactions, as well as technical data including IP address, browser type, error logs and request metadata,
                  strictly for the purpose of operating, securing and improving the service. Data may be stored or processed
                  on servers outside the State of Qatar.
                </p>
                <p>
                  Wishly remains responsible for deciding how your data is used (data controller), while such providers act as
                  data processors on our behalf and are subject to their own terms and privacy policies. We do not sell your
                  personal data, and we only share what is reasonably necessary to provide Wishlys features and comply with
                  applicable law.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">5. AI features and external AI providers</h3>
                <p>
                  Some Wishly features rely on external AI services. For example, when you use tools that extract information
                  from links or images, we may send parts of the content (such as product URLs, titles and text extracted from
                  images) to AI providers through Supabase Edge Functions. These providers may include services such as Gemini,
                  DeepSeek or similar AI platforms that help generate or structure information.
                </p>
                <p>
                  We aim to limit the personal data included in these prompts to what is necessary for the feature to work.
                  You should not submit passwords, financial details, highly sensitive health information or any other content
                  that you would not reasonably share with a third-party service.
                </p>
                <p>
                  Content processed by these AI providers is subject to their own terms and privacy policies and may be stored
                  or processed outside Qatar. We use such services to improve your experience (for example, by speeding up
                  product entry) and to help detect abuse, but we remain responsible for how we integrate AI into Wishly.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">6. Data storage, retention &amp; security</h3>
                <p>
                  Data is stored using modern cloud infrastructure. We apply reasonable technical and organisational
                  measures to protect data, but no online system can be guaranteed 100% secure.
                </p>
                <p>
                  We generally keep data for as long as your account is active, or as needed to provide the service and
                  comply with legal obligations. If you delete your account, we will remove or anonymise personal data within
                  a reasonable period, except where we are required to retain certain records.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">7. Your rights</h3>
                <p>
                  Subject to Qatari law and other applicable regulations, you may have rights to:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Access or request a copy of certain personal data we hold about you.</li>
                  <li>Correct inaccurate or incomplete personal data.</li>
                  <li>Request deletion of your account and associated personal data, where legally permitted.</li>
                  <li>Object to or restrict certain types of processing, where applicable.</li>
                  <li>Withdraw consent where processing is based on your consent.</li>
                </ul>
                <p>
                  You can usually manage much of this directly inside Wishly (for example, via account settings, privacy
                  controls or the option to delete your account). For anything else, you can reach out through our contact
                  channels in the app or on our website.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">8. External links, images and embedded content</h3>
                <p>
                  When you paste a product link or add external content, Wishly may fetch metadata (for example, title,
                  description, image and price) from the website you linked. When images or other assets are loaded from
                  external servers, those third-party sites may see technical information such as your IP address, browser
                  type and the page that requested the content.
                </p>
                <p>
                  In some cases, we download remote images and re-upload them to our own storage to improve reliability, but
                  the original host may still have processed your request when the image was first accessed.
                </p>
                <p>
                  You are responsible for ensuring that any links, images or content you add are lawful and that you have the
                  right to use them. You must not upload or share content that infringes copyright, trademarks or other
                  intellectual property rights, or that is otherwise illegal or harmful.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">9. Acceptable use, community content &amp; suspension</h3>
                <p>
                  You agree to use Wishly only for lawful purposes and in accordance with these terms. In particular, you
                  agree that you will not:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Violate any applicable laws or regulations.</li>
                  <li>Use Wishly in a fraudulent way or for fraudulent purposes.</li>
                  <li>Harm or attempt to harm minors or vulnerable people in any way.</li>
                  <li>Gain or attempt to gain unauthorised access to any computer system, account or network.</li>
                  <li>Interfere with or disrupt other people’s use or enjoyment of Wishly.</li>
                  <li>Upload or transmit viruses, malicious code or any other technologically harmful material.</li>
                  <li>Impersonate any person or entity, or misrepresent your identity or relationship with others.</li>
                </ul>
                <p>
                  Parts of Wishly may allow user-generated content such as comments or social interactions. Views expressed
                  by users do not represent Wishly or its partners. You are responsible for ensuring that anything you share
                  does not infringe third-party rights and is not unlawful, defamatory, offensive or otherwise inappropriate.
                </p>
                <p>
                  We may suspend, restrict or terminate your access to Wishly, remove content you have posted, and where
                  necessary notify or cooperate with law enforcement authorities if we reasonably believe you have breached
                  these terms or applicable law.
                </p>
                <p>
                  Wishly may include links to third‑party websites, content or sponsored material. We are not responsible for
                  the availability or accuracy of external content, and any third-party providers remain responsible for
                  ensuring that their material complies with applicable legal and ethical standards.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">10. Changes to this page</h3>
                <p>
                  We may update this Privacy &amp; Terms page from time to time, for example when we launch new features or
                  when the law changes. Where changes are significant, we will take reasonable steps to let you know (for
                  example inside the app or on our website). Your continued use of Wishly means you accept the updated
                  terms.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">11. Contact</h3>
                <p>
                  If you have questions about how Wishly handles your data, or if you want to exercise your rights, please
                  contact us using the "Contact us" option in the app or via the channels listed on our official website or
                  app store page.
                </p>
              </section>
            </div>
          </section>
          )}

          {/* Arabic column */}
          {i18n.language && i18n.language.startsWith('ar') && (
          <section className="space-y-8 bg-card/80 backdrop-blur rounded-3xl border border-border/50 p-6 md:p-8 shadow-xl text-right" dir="rtl">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold">
                وشلي
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-primary">
                سياسة الخصوصية وشروط الاستخدام
              </h2>
              <p className="text-xs text-muted-foreground">
                آخر تحديث: 2025 • هذه الصفحة توضيحية ولا تُعتبر استشارة قانونية.
              </p>
            </header>

            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">1. الالتزام القانوني والاختصاص القضائي</h3>
                <p>
                  تم تصميم وشلي ليكون متوافقاً مع القوانين المعمول بها في دولة قطر، بما في ذلك قانون رقم (13) لسنة 2016
                  بشأن حماية خصوصية البيانات الشخصية قدر الإمكان. باستخدامك لتطبيق وشلي، فإنك تقر بأن هذه الشروط وجميع
                  الخدمات التي نقدمها تخضع لقوانين دولة قطر، وأن أي نزاعات أو مسؤوليات قانونية تكون من اختصاص المحاكم
                  المختصة في دولة قطر، مع احتفاظنا بحق اتخاذ الإجراءات في أي ولاية قضائية أخرى عند الاقتضاء.
                </p>
                <p>
                  قد نشارك بعض المعلومات مع الجهات الرسمية المختصة عند وجود طلبات قانونية صحيحة، وذلك وفقاً لأحكام
                  القانون القطري.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">2. البيانات التي نقوم بجمعها</h3>
                <p>يعتمد نوع البيانات على طريقة استخدامك للتطبيق، وقد يشمل على سبيل المثال لا الحصر:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="font-medium">بيانات الحساب</span> – مثل البريد الإلكتروني، الاسم أو اسم المستخدم، صورة
                    الملف الشخصي وبعض الإعدادات الأساسية.
                  </li>
                  <li>
                    <span className="font-medium">بيانات القوائم والتواصل الاجتماعي</span> – القوائم التي تنشئها، العناصر
                    التي تضيفها، الحجوزات/الالتزامات بالهدايا، المناسبات، والمتابعين والمتابَعين وتفاعلاتك مع الأصدقاء
                    والعلامات التجارية.
                  </li>
                  <li>
                    <span className="font-medium">الرسائل والإشعارات</span> – الرسائل التي ترسلها وتستقبلها، إشعارات
                    النشاط، وبعض البيانات الفنية المرتبطة بها.
                  </li>
                  <li>
                    <span className="font-medium">البيانات التقنية والاستخدام</span> – نوع الجهاز، وبعض المعلومات التقريبية
                    عن الموقع (مثل الدولة)، وأنماط استخدام التطبيق، والسجلات الأساسية اللازمة لتحسين الأداء والحماية.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">3. كيفية استخدامنا لبياناتك</h3>
                <p>نستخدم بياناتك بشكل عام من أجل:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>تشغيل تطبيق وشلي وتقديم الميزات الرئيسية مثل القوائم والمناسبات والتواصل الاجتماعي.</li>
                  <li>مساعدتك على مشاركة قوائمك مع الآخرين والتحكم في من يمكنه رؤية كل قائمة.</li>
                  <li>حماية الحسابات ومنع إساءة الاستخدام والتحقيق في الأنشطة المشبوهة أو الضارة.</li>
                  <li>فهم كيفية استخدام التطبيق لتحسين التجربة والأداء والاستقرار.</li>
                </ul>
                <p>
                  قد يستند المعالجة إلى موافقتك، أو على الحاجة لتنفيذ اتفاق معك، أو على مصلحتنا المشروعة في تشغيل خدمة
                  آمنة ومفيدة، أو على التزامنا ببعض المتطلبات القانونية.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">4. مشاركة البيانات مع مزوّدي الخدمة والبنية التحتية</h3>
                <p>
                  يعتمد تشغيل وشلي على مزوّدي خدمة خارجيين موثوقين. نستخدم على وجه الخصوص خدمة Supabase لتوفير تسجيل
                  الدخول وقواعد البيانات والميزات الفورية وتخزين الملفات، ونستخدم مزوّد استضافة سحابي (مثل Vercel أو خدمة
                  مشابهة) لتقديم واجهة الويب.
                </p>
                <p>
                  قد تعالج هذه الجهات بيانات شخصية مثل بريدك الإلكتروني وبيانات ملفك الشخصي وقوائم الأمنيات وتفاعلاتك،
                  بالإضافة إلى بعض البيانات التقنية مثل عنوان الـ IP ونوع المتصفح وسجلات الأخطاء وبيانات الطلبات، وذلك فقط
                  بغرض تشغيل الخدمة وحمايتها وتحسينها. قد يتم تخزين البيانات أو معالجتها على خوادم خارج دولة قطر.
                </p>
                <p>
                  تبقى وشلي مسؤولة عن تحديد كيفية استخدام بياناتك (المتحكّم بالبيانات)، بينما تعمل هذه الجهات كمزوّدين
                  لمعالجة البيانات نيابةً عنا ووفقاً لشروط الاستخدام وسياسات الخصوصية الخاصة بهم. لا نقوم ببيع بياناتك
                  الشخصية، ونشارك فقط الحد اللازم لتقديم ميزات وشلي والامتثال للقوانين المعمول بها.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">5. ميزات الذكاء الاصطناعي ومزوّدو الذكاء الاصطناعي الخارجيون</h3>
                <p>
                  تعتمد بعض ميزات وشلي على خدمات ذكاء اصطناعي مقدَّمة من أطراف ثالثة. فعلى سبيل المثال، عند استخدامك
                  لأدوات استخراج المعلومات من الروابط أو الصور، قد نقوم بإرسال جزء من المحتوى (مثل عناوين الروابط أو أسماء
                  المنتجات أو النصوص المستخرجة من الصور) إلى مزوّدي ذكاء اصطناعي عبر وظائف Supabase الطرفية. قد تشمل هذه
                  المزوّدين خدمات مثل Gemini أو DeepSeek أو منصات ذكاء اصطناعي مشابهة تساعد في توليد المعلومات أو تنظيمها.
                </p>
                <p>
                  نسعى إلى تقليل البيانات الشخصية المضمَّنة في هذه الطلبات إلى الحد اللازم لعمل الميزة. يجب عليك عدم إرسال
                  كلمات المرور أو البيانات المالية أو المعلومات الصحية شديدة الحساسية أو أي محتوى لا ترغب بمشاركته مع خدمة
                  خارجية.
                </p>
                <p>
                  يخضع المحتوى الذي تتم معالجته من قبل مزوّدي الذكاء الاصطناعي لشروط الاستخدام وسياسات الخصوصية الخاصة
                  بهم، وقد يُخزَّن أو يُعالَج خارج دولة قطر. نستخدم هذه الخدمات لتحسين تجربتك (مثل تسريع إضافة المنتجات)
                  وللمساعدة في كشف إساءة الاستخدام، مع بقاء وشلي مسؤولة عن كيفية دمج الذكاء الاصطناعي في التطبيق.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">6. التخزين والاحتفاظ بالبيانات والحماية</h3>
                <p>
                  يتم تخزين البيانات باستخدام بنية تحتية سحابية عصرية. نسعى لتطبيق إجراءات تقنية وتنظيمية معقولة لحماية
                  البيانات، مع العلم بأن أي نظام على الإنترنت لا يمكن أن يكون آمناً بنسبة 100٪.
                </p>
                <p>
                  نحتفظ عادةً ببياناتك طوال فترة نشاط حسابك أو حسب ما يلزم لتقديم الخدمة والامتثال للالتزامات القانونية.
                  عند حذف حسابك، نقوم بحذف أو إخفاء هويتك من البيانات خلال فترة زمنية معقولة، ما لم نكن ملزمين بالاحتفاظ
                  ببعض السجلات.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">7. حقوقك</h3>
                <p>
                  وفقاً للقانون القطري والأنظمة المعمول بها، قد يكون لك الحق في:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>طلب الاطلاع على بعض البيانات الشخصية التي نحتفظ بها عنك.</li>
                  <li>تصحيح أي بيانات غير دقيقة أو غير مكتملة.</li>
                  <li>طلب حذف حسابك وبياناتك الشخصية في الحالات المسموح بها قانوناً.</li>
                  <li>الاعتراض على بعض عمليات المعالجة أو طلب تقييدها في بعض الحالات.</li>
                  <li>سحب موافقتك عندما يكون أساس المعالجة هو موافقتك.</li>
                </ul>
                <p>
                  يمكنك إدارة الكثير من هذه الخيارات مباشرة من خلال إعدادات الحساب وخصائص الخصوصية داخل التطبيق، أو عن
                  طريق التواصل معنا عبر قنوات الدعم المتاحة.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">8. الروابط الخارجية والصور والمحتوى المضمَّن</h3>
                <p>
                  عند لصقك لرابط منتج أو إضافة محتوى خارجي، قد يقوم وشلي بجلب بعض البيانات الوصفية من الموقع المرتبط
                  (مثل العنوان والوصف والصورة والسعر). وعند تحميل الصور أو الملفات من خوادم خارجية، قد تتمكّن تلك المواقع
                  من رؤية بعض المعلومات التقنية مثل عنوان الـ IP ونوع المتصفح والصفحة التي طلبت المحتوى.
                </p>
                <p>
                  في بعض الحالات نقوم بتنزيل الصور من المصادر الخارجية وإعادة رفعها إلى نظام التخزين الخاص بنا لتحسين
                  الاعتمادية، إلا أن المزوّد الأصلي للصورة قد يكون قد عالج طلبك عند الوصول إلى الصورة لأول مرة.
                </p>
                <p>
                  تتحمّل وحدك مسؤولية أن تكون الروابط والصور وأي محتوى تضيفه قانونياً وأن تمتلك الحق في استخدامه. يُحظر عليك
                  تحميل أو مشاركة أي محتوى ينتهك حقوق النشر أو العلامات التجارية أو أي حقوق ملكية فكرية أخرى، أو أي محتوى غير
                  قانوني أو ضار.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">9. الاستخدام المقبول والمحتوى المجتمعي وإيقاف الحساب</h3>
                <p>
                  توافق على استخدام وشلي لأغراض مشروعة فقط ووفقاً لهذه الشروط. وعلى وجه الخصوص، فإنك توافق على عدم:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>مخالفة أي قوانين أو أنظمة معمول بها.</li>
                  <li>استخدام وشلي بطريقة احتيالية أو لأغراض احتيالية.</li>
                  <li>إيذاء القُصَّر أو الفئات الضعيفة أو محاولة إيذائهم بأي شكل من الأشكال.</li>
                  <li>محاولة الوصول غير المصرح به إلى أي نظام حاسوبي أو حساب أو شبكة.</li>
                  <li>التسبب في تعطيل أو إزعاج استخدام الآخرين للتطبيق أو الاستمتاع به.</li>
                  <li>نشر أو إرسال فيروسات أو شيفرات خبيثة أو أي مواد تقنية ضارة أخرى.</li>
                  <li>انتحال شخصية أي فرد أو جهة، أو تقديم نفسك أو علاقتك بالآخرين بطريقة مضلِّلة.</li>
                </ul>
                <p>
                  قد تتضمن بعض أجزاء وشلي محتوى ينشئه المستخدمون، مثل التعليقات أو التفاعلات الاجتماعية. الآراء المنشورة من
                  قبل المستخدمين لا تعبِّر بالضرورة عن رأي وشلي أو شركائه. أنت وحدك المسؤول عن أن يكون ما تشاركه خالياً من
                  انتهاك حقوق الغير أو أي مواد غير قانونية أو تشهيرية أو مسيئة أو غير ملائمة.
                </p>
                <p>
                  يجوز لنا تعليق أو تقييد أو إيقاف وصولك إلى وشلي، أو إزالة أي محتوى قمت بنشره، وعند الضرورة إبلاغ الجهات
                  الرسمية المختصة أو التعاون معها إذا كان لدينا سبب معقول للاعتقاد بأنك خالفت هذه الشروط أو أحكام القانون.
                </p>
                <p>
                  وشلي ليس مكاناً للمحتوى الجنسي أو المسيء. يُحظر عليك تحميل أو مشاركة أو إنشاء محتوى إباحي أو جنسي صريح،
                  أو أي محتوى يستغل القُصَّر أو الفئات الضعيفة أو يجنسيهم، أو محتوى يتضمّن تحرّشاً أو كراهية أو عنصرية أو
                  تمييزاً أو إهانة عميقة لأفراد أو فئات، أو محتوى يروّج لإيذاء النفس أو العنف أو الاستغلال أو أي شكل من
                  أشكال الضرر لك أو للآخرين.
                </p>
                <p>
                  قد يتضمن وشلي روابط لمواقع أو محتوى أو مواد دعائية تابعة لأطراف ثالثة. لا نتحمل مسؤولية توافر أو دقة هذا
                  المحتوى الخارجي، وتبقى الجهات الخارجية وحدها مسؤولة عن التزام إعلاناتها ومحتواها بالمعايير القانونية
                  والأخلاقية المعمول بها.
                </p>
                <p>
                  تبقى أسماء وشعارات الخدمات الخارجية (مثل تطبيقات المراسلة أو منصات التواصل الاجتماعي أو مصنّعي الأجهزة)
                  المذكورة في وشلي علامات تجارية مملوكة لأصحابها. ما لم نُصرّح بخلاف ذلك صراحةً، فإن وشلي ليست جهة تابعة أو
                  ممثَّلة أو راعية لتلك الشركات. لا يجوز لك استخدام وشلي للإيحاء كذباً بوجود شراكة مع أي علامة تجارية، أو
                  لانتحال صفة حسابات رسمية، أو لتضليل الآخرين بشأن علاقتك بأي خدمة أو جهة خارجية.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">10. تحديث هذه الصفحة</h3>
                <p>
                  قد نقوم بتحديث سياسة الخصوصية وشروط الاستخدام من وقت لآخر، مثلاً عند إضافة ميزات جديدة أو عند تغير
                  القوانين. سنحاول إبلاغك بالتغييرات الجوهرية داخل التطبيق أو عبر منصاتنا الرسمية. استمرارك في استخدام وشلي
                  بعد التحديث يعني موافقتك على الشروط المحدَّثة.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">11. التواصل معنا</h3>
                <p>
                  إذا كانت لديك أي أسئلة حول كيفية تعامل وشلي مع بياناتك، أو إذا رغبت في ممارسة أي من حقوقك، فيمكنك التواصل
                  معنا من خلال خيار "تواصل معنا" داخل التطبيق أو عبر قنوات الاتصال الرسمية المذكورة في موقعنا أو صفحة
                  التطبيق في متاجر التطبيقات.
                </p>
              </section>
            </div>
          </section>
          )}
        </div>
      </main>

      {/* Footer (same as HomePage) */}
      <footer className="border-t py-6 mt-20 text-sm">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-muted-foreground">
          <p className="text-center md:text-left">
            {t('footer.copyright', '© 2025 Wishly. All rights reserved.')}
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
            <a href="/contact" className="hover:text-primary transition-colors">
              {t('footer.contact', 'Contact us')}
            </a>
            <a href="/privacy" className="hover:text-primary transition-colors">
              {t('footer.privacy_terms', 'Privacy & Terms')}
            </a>
            <span className="inline-flex items-center gap-1">
              <span>{t('footer.made_by', 'Made by')}</span>
              <a
                href="https://tmw.qa/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-primary hover:underline"
              >
                {t('footer.made_by_name', 'TMW')}
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyTerms;
