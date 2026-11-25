(() => {
  const STORAGE_KEY = 'itc_lang';
  const frTextMap = new WeakMap();
  const frPlaceholderMap = new WeakMap();

  const COURSES_DARIJA = {
    'Anglais technique': [
      'الإنجليزية التقنية',
      'مصطلحات وتواصل مهني خاص بمجال المعلوميات.',
    ],
    'Microsoft Office (Word, Excel, PowerPoint)': [
      'Microsoft Office (Word، Excel، PowerPoint)',
      'الباك الكامل ديال البيروتيك.',
    ],
    'Word seulement': [
      'Word بوحدو',
      'تنسيق النصوص، الوثائق والتقارير.',
    ],
    'Excel seulement': [
      'Excel بوحدو',
      'الصيغ الحسابية، الجداول والرسوم البيانية.',
    ],
    'Développement web (HTML, CSS, JS)': [
      'تطوير المواقع (HTML، CSS، JS)',
      'صاوب المواقع والتطبيقات ديالك بيديك.',
    ],
    'WordPress': [
      'WordPress',
      'صاوب وسير موقع إلكتروني بلا ما تكتب الكود.',
    ],
    'Comptabilité générale': [
      'المحاسبة العامة',
      'الأساسيات والتطبيق العملي فـ المحاسبة.',
    ],
    'Français et communication': [
      'الفرنسية والتواصل',
      'التعبير الكتابي والشفوي بكل طلاقة.',
    ],
    'Maintenance informatique': [
      'صيانة الحاسوب والمعلوميات',
      'التشخيص، الإصلاح وصيانة الأجهزة.',
    ],
    'E-commerce': [
      'التجارة الإلكترونية (E-commerce)',
      'أطلق وسير المتجر الإلكتروني ديالك.',
    ],
    "Outils de l'intelligence artificielle et fonctionnement": [
      'أدوات الذكاء الاصطناعي وكيفية العمل بها',
      'فهم واستعمل الذكاء الاصطناعي فـ حياتك اليومية والمهنية.',
    ],
    'Orientation et coaching': [
      'التوجيه والكوتشينغ',
      'مواكبة فابور باش تختار التكوين اللي كيناسبك.',
    ],
  };

  const NAV_DARIJA = {
    'Accueil': 'الرئيسية',
    'Vidéo': 'الفيديو',
    'Formations': 'التكوينات',
    'Inscription': 'التسجيل',
    'À propos': 'علينا',
    'Devis': 'عرض ثمن',
    'Contact': 'تواصل معنا',
  };

  const RADIO_DARIJA = {
    'En groupe': 'فـ مجموعة',
    'Individuelle': 'فردي',
    'Personnalisée': 'مخصص (2 حتى لـ 3 وحدات)',
    'À distance': 'عن بُعد',
    'Présentiel': 'حضوري',
    'Hybride': 'مخلط (عن بُعد + حضوري)',
  };

  const SLIDES_DARIJA = [
    {
      h1: 'تعلّم المعلوميات فين ما كنتي',
      p: 'تكوينات عن بُعد فـ تطوير المواقع، البيروتيك، المحاسبة وأدوات الذكاء الاصطناعي، مع متابعة شخصية.',
      btn: 'شوف التكوينات',
    },
    {
      h1: 'التواصل والتسويق الرقمي',
      p: 'تعلّم تسيير مواقع التواصل الاجتماعي، صناعة المحتوى والتواصل المهني.',
      btn: 'تواصل معنا',
    },
    {
      h1: 'البيروتيك، تطوير المواقع، الذكاء الاصطناعي والتجارة الإلكترونية',
      p: 'Microsoft Office (Word، Excel، PowerPoint)، HTML/CSS/JS، WordPress، المحاسبة العامة، صيانة الحاسوب، الإنجليزية التقنية، الفرنسية وأدوات الذكاء الاصطناعي.',
      btn: 'اكتشف المزيد',
    },
    {
      h1: 'مواكبة ومتابعة شخصية خطوة بخطوة',
      p: 'قرا على راحتك وبوقتك، فـ مجموعة ولا بوحدك، وطرح أسئلتك مباشرة للأستاذ ديالك.',
      btn: 'راسلنا على واتساب',
    },
  ];

  function setText(el, darija, isDarija) {
    if (!el) return;
    if (!frTextMap.has(el)) frTextMap.set(el, el.textContent);
    el.textContent = isDarija ? darija : frTextMap.get(el);
  }

  function setPlaceholder(el, darija, isDarija) {
    if (!el) return;
    if (!frPlaceholderMap.has(el)) frPlaceholderMap.set(el, el.getAttribute('placeholder') || '');
    el.setAttribute('placeholder', isDarija ? darija : frPlaceholderMap.get(el));
  }

  function translateLabelKeepingInput(label, newText) {
    if (!label) return;
    const input = label.querySelector('input');
    const badge = label.querySelector('.free');
    if (!input) return;
    label.replaceChildren(input, document.createTextNode(' ' + newText));
    if (badge) {
      label.appendChild(document.createTextNode(' '));
      label.appendChild(badge);
    }
  }

  function updateHoursLabel(isDarija) {
    const dhl = document.getElementById('dhl');
    const checked = document.querySelector('[name="typ"]:checked');
    if (!dhl || !checked) return;
    const t = checked.value;
    if (isDarija) {
      dhl.textContent =
        t === 'En groupe'
          ? 'عدد الحصص (ساعتين) لكل تكوين'
          : t === 'Personnalisée'
          ? 'مجموع عدد الساعات'
          : 'عدد الساعات لكل تكوين';
    } else {
      dhl.textContent =
        t === 'En groupe'
          ? 'Nombre de séances (2h) par formation'
          : t === 'Personnalisée'
          ? "Nombre total d'heures"
          : "Nombre d'heures par formation";
    }
  }

  function applyLanguage(lang) {
    const isDarija = lang === 'darija';
    document.documentElement.lang = isDarija ? 'ar-MA' : 'fr';
    document.documentElement.dir = isDarija ? 'rtl' : 'ltr';
    document.documentElement.dataset.lang = isDarija ? 'darija' : 'fr';

    try {
      localStorage.setItem(STORAGE_KEY, isDarija ? 'darija' : 'fr');
    } catch {
      // Ignore storage restriction
    }

    // Update toggle button
    const btn = document.getElementById('langTg');
    if (btn) {
      btn.textContent = isDarija ? '🇫🇷 Français' : '🇲🇦 الدارجة';
      btn.setAttribute(
        'aria-label',
        isDarija ? 'Revenir en français' : 'Traduire en Darija marocaine'
      );
      btn.setAttribute('aria-pressed', isDarija ? 'true' : 'false');
    }

    // Top bar
    const topSmall = document.querySelector('#toplinks small');
    setText(topSmall, 'الاستمارات :', isDarija);
    document.querySelectorAll('#toplinks a.tl').forEach((a) => {
      const icon = a.querySelector('.lg');
      if (!a.dataset.frLabel) {
        a.dataset.frLabel = a.textContent.replace(icon ? icon.textContent : '', '').trim();
      }
      const fr = a.dataset.frLabel;
      let txt = fr;
      if (isDarija) {
        if (fr.includes('inscription')) txt = 'استمارة التسجيل';
        else if (fr.includes('contact')) txt = 'استمارة التواصل';
      }
      a.replaceChildren();
      if (icon) a.appendChild(icon);
      a.appendChild(document.createTextNode(txt));
    });

    // Navigation links
    document.querySelectorAll('#menu a').forEach((a) => {
      if (!a.dataset.frNav) a.dataset.frNav = a.textContent.trim();
      const fr = a.dataset.frNav;
      a.textContent = isDarija && NAV_DARIJA[fr] ? NAV_DARIJA[fr] : fr;
    });

    // Hero slides
    document.querySelectorAll('.slide').forEach((slide, idx) => {
      const tr = SLIDES_DARIJA[idx];
      if (!tr) return;
      setText(slide.querySelector('h1'), tr.h1, isDarija);
      setText(slide.querySelector('p'), tr.p, isDarija);
      setText(slide.querySelector('.btn'), tr.btn, isDarija);
    });

    // Video section
    setText(document.querySelector('#video h2'), 'تعرّف على ITCAcademy', isDarija);
    setText(
      document.querySelector('#video .sub'),
      'بوابتك نحو التميز الرقمي: تفرّج فـ الفيديو التعريفي ديالنا.',
      isDarija
    );

    // Formations section
    setText(document.querySelector('#formations h2'), 'التكوينات ديالنا عن بُعد', isDarija);
    setText(
      document.querySelector('#formations .sub'),
      'دروس أونلاين، تطبيقية وساهلة تبعها من البيسي ولا من التيليفون ديالك.',
      isDarija
    );

    document.querySelectorAll('#fgrid .card').forEach((card) => {
      const h3 = card.querySelector('h3');
      const p = card.querySelector('p');
      const more = card.querySelector('.more');
      const freeBadge = h3?.querySelector('.free');
      if (h3 && !h3.dataset.frCourse) {
        h3.dataset.frCourse = h3.textContent.replace('GRATUIT', '').trim();
      }
      const key = h3?.dataset.frCourse || '';
      const entry = COURSES_DARIJA[key];
      if (h3 && entry) {
        h3.replaceChildren(document.createTextNode(isDarija ? entry[0] : key));
        if (freeBadge) {
          freeBadge.textContent = isDarija ? 'فابور' : 'GRATUIT';
          h3.appendChild(document.createTextNode(' '));
          h3.appendChild(freeBadge);
        }
      }
      if (p && entry) setText(p, entry[1], isDarija);
      if (more) setText(more, 'طلب عرض ثمن', isDarija);
    });

    // À propos section
    setText(document.querySelector('#apropos h2'), 'علاش تختار ITCACADEMY؟', isDarija);
    setText(
      document.querySelector('#apropos .sub'),
      'مركز تكوين 100% عن بُعد: دروس تطبيقية، أساتذة متوفرين ليك ومتابعة كتناسب وقتك.',
      isDarija
    );
    const statLabels = ['متدرب تكونو عندنا', 'وحدة دراسية', '% عن بُعد'];
    document.querySelectorAll('#apropos .stat span').forEach((span, idx) => {
      if (statLabels[idx]) setText(span, statLabels[idx], isDarija);
    });
    const term = document.querySelector('.term');
    if (term) term.setAttribute('dir', 'ltr');

    // Devis section
    const devisSec = document.getElementById('devis');
    if (devisSec) {
      setText(devisSec.querySelector('h2'), 'طلب عرض ثمن (Devis)', isDarija);
      const subs = devisSec.querySelectorAll('.sub');
      setText(
        subs[0],
        'ختار التكوينات وطريقة القراية اللي بغيتي. غادي توصلك نسخة PDF وغادي توصلنا نسخة على واتساب.',
        isDarija
      );
      setText(
        subs[1],
        'الأثمنة: عن بُعد 100 درهم/ساعة · حضوري 120 درهم/ساعة · مخلط 90 درهم/ساعة · تطوير المواقع، WordPress والمحاسبة: 120 درهم/ساعة عن بُعد، 150 درهم/ساعة حضوري · فـ مجموعة: 50 درهم للحصة ديال ساعتين (عن بُعد)، 80 درهم (حضوري) · تكوين مخصص (2 حتى لـ 3 وحدات): 150 درهم/ساعة · التوجيه والكوتشينغ فابور.',
        isDarija
      );
      setPlaceholder(document.getElementById('dn'), 'الاسم الكامل', isDarija);
      setPlaceholder(
        document.getElementById('dt'),
        'رقم واتساب إجباري (مثال: 0660 83 72 85)',
        isDarija
      );
      setPlaceholder(document.getElementById('de'), 'البريد الإلكتروني', isDarija);
      setPlaceholder(
        document.getElementById('dm'),
        'تفاصيل إضافية (المستوى، الأوقات المناسبة، الهدف...)',
        isDarija
      );

      const legends = devisSec.querySelectorAll('legend');
      const devisLegends = [
        'التكوينات اللي بغيتي',
        'نوع التكوين',
        'طريقة القراية',
        'القائمة الفرعية – تكوين مخصص (كوشي 2 حتى لـ 3 تكوينات)',
      ];
      legends.forEach((lg, idx) => {
        if (devisLegends[idx]) setText(lg, devisLegends[idx], isDarija);
      });

      setText(
        document.getElementById('persInfo'),
        'ختار 2 حتى لـ 3 تكوينات باش تصاوب البرنامج المخصص ديالك.',
        isDarija
      );
      setText(devisSec.querySelector('button[type="submit"]'), 'خرج عرض الثمن PDF', isDarija);
      updateHoursLabel(isDarija);
    }

    // Dedicated Inscription page
    const inscSec = document.getElementById('inscription');
    if (inscSec) {
      setText(inscSec.querySelector('a[href="index.html"]'), '← رجوع للرئيسية', isDarija);
      setText(inscSec.querySelector('h2'), 'استمارة التسجيل', isDarija);
      setText(
        inscSec.querySelector('.sub'),
        'عمّر هاد الاستمارة باش تسجّل فـ التكوينات ديالنا. المعلومات ديالك محفوظة ومشفّرة فـ قاعدة بيانات خاصة بالإدارة فقط.',
        isDarija
      );
      setPlaceholder(document.getElementById('inNom'), 'الاسم الكامل *', isDarija);
      setPlaceholder(
        document.getElementById('inWa'),
        'رقم واتساب إجباري (مثال: 0660 83 72 85)',
        isDarija
      );
      setPlaceholder(document.getElementById('inMail'), 'البريد الإلكتروني (اختياري)', isDarija);
      setPlaceholder(
        document.getElementById('inPrec'),
        'تفاصيل إضافية (المستوى الحالي، الأوقات المناسبة، الهدف...)',
        isDarija
      );
      const inscLegends = [
        'التكوينات اللي بغيتي',
        'نوع التكوين',
        'طريقة القراية',
        'القائمة الفرعية – تكوين مخصص (كوشي 2 حتى لـ 3 تكوينات)',
      ];
      inscSec.querySelectorAll('#inscForm legend').forEach((lg, idx) => {
        if (inscLegends[idx]) setText(lg, inscLegends[idx], isDarija);
      });
      setText(
        document.getElementById('inscPersInfo'),
        'ختار 2 حتى لـ 3 تكوينات باش تصاوب البرنامج المخصص ديالك.',
        isDarija
      );
      setText(inscSec.querySelector('#inscForm button[type="submit"]'), 'تأكيد التسجيل', isDarija);
      setText(
        inscSec.querySelector('.db-summary'),
        '🔒 فضاء الإدارة — قاعدة بيانات JSON مشفّرة وتحميل Excel (.xlsx)',
        isDarija
      );
    }

    // Course checkboxes (both Devis & Inscription forms)
    document
      .querySelectorAll('#fopts label, #popts label, #inscFopts label, #inscPopts label')
      .forEach((label) => {
        const cb = label.querySelector('input[type="checkbox"]');
        if (!cb) return;
        const val = cb.value;
        const badge = label.querySelector('.free');
        if (badge) badge.textContent = isDarija ? 'فابور' : 'gratuit';
        const entry = COURSES_DARIJA[val];
        translateLabelKeepingInput(label, isDarija && entry ? entry[0] : val);
      });

    // Radio labels (Type & Mode across both pages)
    document
      .querySelectorAll(
        'input[name="typ"], input[name="mod"], input[name="ityp"], input[name="imod"]'
      )
      .forEach((radio) => {
        const label = radio.closest('label');
        if (!label) return;
        if (!label.dataset.frRadio) label.dataset.frRadio = label.textContent.trim();
        const val = radio.value;
        translateLabelKeepingInput(
          label,
          isDarija && RADIO_DARIJA[val] ? RADIO_DARIJA[val] : label.dataset.frRadio
        );
      });

    // Contact section
    const contactSec = document.getElementById('contact');
    if (contactSec) {
      setText(contactSec.querySelector('h2'), 'تواصل معنا', isDarija);
      setText(
        contactSec.querySelector('.sub'),
        'عندك شي سؤال على شي تكوين؟ كتب لينا وغادي نجاوبوك بسرعة.',
        isDarija
      );
      const ciTitles = contactSec.querySelectorAll('.ci b');
      setText(ciTitles[0], 'واتساب', isDarija);
      setText(ciTitles[1], 'البريد الإلكتروني', isDarija);
      const cBtns = contactSec.querySelectorAll('.contact a.btn');
      setText(cBtns[0], 'واتساب', isDarija);
      setText(cBtns[1], 'صيفط إيميل', isDarija);
      setPlaceholder(document.getElementById('nm'), 'سميتك', isDarija);
      setPlaceholder(document.getElementById('em'), 'الإيميل ديالك', isDarija);
      setPlaceholder(document.getElementById('tx'), 'الرسالة ديالك', isDarija);
      setText(contactSec.querySelector('#f button[type="submit"]'), 'صيفط الرسالة', isDarija);
    }

    // Footer
    const footer = document.querySelector('footer');
    if (footer) {
      setText(
        footer.querySelector('.fcols p'),
        'مركز تكوين عن بُعد فـ المعلوميات والتواصل.',
        isDarija
      );
      setText(footer.querySelector('.fcols h4'), 'التواصل', isDarija);
      const copy = footer.querySelector('.copy');
      if (copy) {
        const yr = new Date().getFullYear();
        copy.textContent = isDarija
          ? `© ${yr} ITCACADEMY. جميع الحقوق محفوظة.`
          : `© ${yr} ITCACADEMY. Tous droits réservés.`;
      }
    }
  }

  // Keep hours label translated when user toggles type radios
  document.querySelectorAll('[name="typ"]').forEach((r) => {
    r.addEventListener('change', () => {
      updateHoursLabel(document.documentElement.dataset.lang === 'darija');
    });
  });

  const langBtn = document.getElementById('langTg');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      langBtn.classList.remove('lang-flip');
      void langBtn.offsetWidth;
      langBtn.classList.add('lang-flip');
      const next = document.documentElement.dataset.lang === 'darija' ? 'fr' : 'darija';
      applyLanguage(next);
    });
    langBtn.addEventListener('animationend', (e) => {
      if (e.animationName === 'langFlip') langBtn.classList.remove('lang-flip');
    });
  }

  function initSavedLang() {
    let saved = 'fr';
    try {
      saved = localStorage.getItem(STORAGE_KEY) || 'fr';
    } catch {
      saved = 'fr';
    }
    if (saved === 'darija') {
      applyLanguage('darija');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSavedLang);
  } else {
    initSavedLang();
  }
})();
