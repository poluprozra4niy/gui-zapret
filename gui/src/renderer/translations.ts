export type TranslationKey = keyof typeof translations.ru

export const translations = {
    ru: {
        appTitle: "Zapret GUI",
        subtitle: "Discord & YouTube Access",
        tabs: {
            main: "Главная",
            advanced: "Дополнительно",
            license: "Лицензии"
        },
        status: {
            serviceRunning: "🔄 Работает через сервис",
            activateStrategy: "АКТИВИРОВАТЬ СТРАТЕГИЮ",
            scanning: "СКАНИРОВАНИЕ...",
            findStrategies: "НАЙТИ СТРАТЕГИИ",
            update: "ОБНОВИТЬ",
            checking: "ПРОВЕРКА...",
            installing: "УСТАНОВКА...",
            debugConsole: "Консоль отладки",
            waiting: "Ожидание команд..."
        },
        advanced: {
            title: "Дополнительные функции",
            diagnostics: {
                title: "🔧 Диагностика",
                desc: "Проверка системы на конфликты"
            },
            installService: {
                title: "📋 Установить сервис",
                desc: "Автозапуск при загрузке Windows"
            },
            removeService: {
                title: "🗑️ Удалить сервис",
                desc: "Остановить автозапуск"
            },
            runTests: {
                title: "🧪 Запустить тесты",
                desc: "Тестирование стратегий"
            },
            gameFilter: {
                title: "🎮 Игровой фильтр",
                on: "Включен (1024-65535)",
                off: "Выключен (12)"
            },
            ipset: {
                title: "🌐 IPSet",
                loaded: "Список загружен",
                none: "Отключено (все IP)",
                any: "Все IP (Any)"
            },
            autostart: {
                title: "🚀 Автозапуск",
                on: "Запускать с Windows",
                off: "Не запускать автоматически"
            },
            networkSettings: {
                title: "🌐 Настройки сети/DNS",
                desc: "Открыть сетевые адаптеры"
            },
            dnsManager: {
                title: "🛠️ Менеджер DNS",
                desc: "Быстрая смена DNS-серверов",
                selectAdapter: "Выберите адаптер:",
                currentDns: "Текущие DNS:",
                dnsV4: "IPv4 DNS",
                dnsV6: "IPv6 DNS",
                doh: "Secure DNS (автоматически)",
                setDns: "Установить DNS",
                resetDns: "Сбросить (Авто)",
                apply: "Применить",
                success: "DNS успешно изменены!",
                error: "Ошибка смены DNS"
            }
        },
        testDialog: {
            title: "Настройка тестирования",
            testType: "ТИП ТЕСТА",
            standard: "Standard",
            standardDesc: "HTTP/HTTPS/Ping",
            dpi: "DPI Checkers",
            dpiDesc: "Deep Analysis (Freeze)",
            runMode: "РЕЖИМ ЗАПУСКА",
            allStrategies: "Все стратегии",
            selectManual: "Выбрать вручную",
            selectFiles: "ВЫБЕРИТЕ ФАЙЛЫ",
            noStrategies: "Стратегии не найдены",
            cancel: "Отмена",
            start: "Запустить тест"
        },
        logs: {
            checkingUpdates: "Проверка обновлений...",
            updateAvailable: "✨ Доступно обновление: {version}",
            updateLatest: "✓ У вас последняя версия ({version})",
            updateError: "⚠ Ошибка проверки: {message}",
            updateCheckFailed: "⚠ Не удалось проверить обновления",
            serviceStarted: "✓ Сервис Zapret запущен",
            serviceStartedStrategy: "✓ Сервис Zapret запущен (стратегия: {strategy})",
            serviceNotRunning: "⚠ Сервис установлен, но не запущен",
            serviceInstalled: "✅ Сервис zapret установлен! Будет запускаться автоматически при старте Windows.",
            serviceInstallFailed: "⚠ Сервис создан, но не запустился: {error}",
            serviceRemoved: "✓ Сервис удалён",
            serviceRemoveFailed: "⚠ Сервис не найден или уже удалён",
            serviceRemoveStarted: "🗑️ Удаление сервиса zapret...",
            diagnosticsStarted: "🔍 Начинаю диагностику системы...",
            ipsetLoaded: "📋 Переключение ipset: loaded → none",
            ipsetNone: "📋 Переключение ipset: none → any",
            ipsetAny: "📋 Переключение ipset: any → loaded",
            ipsetRestored: "✓ ipset: loaded (список восстановлен)",
            ipsetDisabled: "✓ ipset: none (блокировка по IP отключена)",
            ipsetAll: "✓ ipset: any (все IP адреса)",
            ipsetError: "✗ Ошибка: {message}",
            ipsetNoBackup: "✗ Нет backup для восстановления. Обновите список через меню.",
            logSaved: "Логи сохранены: {path}",
            testingStrategy: "--- Testing: {name} ---",
            strategyFailed: "Failed to start {name}. Skipping...",
            strategySuccess: "SUCCESS! Working strategy: {name}",
            strategyError: "FAILED: {error}",
            scanFinished: "Сканирование завершено. Рабочая стратегия не найдена."
        },
        license: {
            title: "Лицензии",
            content: `MIT License

Copyright (c) 2026 poluprozra4niy

Это программное обеспечение состоит из графического приложения (GUI) и встроенных сторонних компонентов.
Каждый компонент лицензируется в соответствии с его собственной лицензией, как описано ниже.

============================================================
ОСНОВНОЙ ПРАГРАММНЫЙ КОМПОНЕНТ
============================================================

1. GUI Application (Графическая оболочка)
Copyright (c) 2026 poluprozra4niy
Лицензия: MIT License

Данное разрешение предоставляется бесплатно любому лицу, получившему копию
данного программного обеспечения и сопутствующих файлов документации ("Программное обеспечение"),
для работы с Программным обеспечением без ограничений, включая, помимо прочего, права
на использование, копирование, изменение, объединение, публикацию, распространение, сублицензирование и/или продажу
копий Программного обеспечения, а также разрешение лицам, которым предоставляется Программное обеспечение,
делать это на следующих условиях:

Указанное выше уведомление об авторских правах и данное уведомление о разрешении должны быть включены во все
копии или существенные части Программного обеспечения.

ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ ПРЕДОСТАВЛЯЕТСЯ "КАК ЕСТЬ", БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ, ЯВНЫХ ИЛИ
ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ, ПОМИМО ПРОЧЕГО, ГАРАНТИИ ТОВАРНОЙ ПРИГОДНОСТИ,
ПРИГОДНОСТИ ДЛЯ КОНКРЕТНОЙ ЦЕЛИ И ОТСУТСТВИЯ НАРУШЕНИЙ ПРАВ. НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ
АВТОРЫ ИЛИ ПРАВООБЛАДАТЕЛИ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ЗА КАКИЕ-ЛИБО ПРЕТЕНЗИИ, УЩЕРБ ИЛИ ИНУЮ
ОТВЕТСТВЕННОСТЬ, БУДЬ ТО В РАМКАХ ДОГОВОРА, ДЕЛИКТА ИЛИ ИНЫМ ОБРАЗОМ, ВОЗНИКШИЕ
В СВЯЗИ С ПРОГРАММНЫМ ОБЕСПЕЧЕНИЕМ ИЛИ ИСПОЛЬЗОВАНИЕМ ПРОГРАММНОГО ОБЕСПЕЧЕНИЯ ИЛИ ИНЫМИ ДЕЙСТВИЯМИ
С ПРОГРАММНЫМ ОБЕСПЕЧЕНИЕМ.

============================================================
СТОРОННИЕ КОМПОНЕНТЫ
============================================================

2. Electron (GUI Framework)
Copyright (c) OpenJS Foundation and contributors
Лицензия: MIT License
Исходный код: https://github.com/electron/electron

Electron используется в качестве фреймворка приложения и среды выполнения.
Лицензия Electron разрешает использование, модификацию и распространение на
условиях лицензии MIT.

------------------------------------------------------------

3. Zapret-discord-youtube (Модифицированные бинарные файлы/скрипты)
Copyright (c) 2024–2025 Flowseal
Лицензия: MIT License
Репозиторий: https://github.com/Flowseal/zapret-discord-youtube

------------------------------------------------------------

4. Zapret (Оригинальное ядро)
Copyright (c) 2016–2025 bol-van
Лицензия: MIT License
Репозиторий: https://github.com/bol-van/zapret

------------------------------------------------------------

5. WinDivert
Copyright (c) basil00
Лицензия: GNU Lesser General Public License (LGPL) версии 3 или 
          GNU General Public License (GPL) версии 2.

Исходный код: https://github.com/basil00/WinDivert

WinDivert включен как неизмененный сторонний компонент.
Его исходный код общедоступен по ссылке выше в соответствии
с требованиями лицензий LGPL/GPL.

============================================================
КОНЕЦ ЛИЦЕНЗИИ
============================================================`
        }
    },
    en: {
        appTitle: "Zapret GUI",
        subtitle: "Discord & YouTube Access",
        tabs: {
            main: "Main",
            advanced: "Advanced",
            license: "License"
        },
        status: {
            serviceRunning: "🔄 Running via Service",
            activateStrategy: "ACTIVATE STRATEGY",
            scanning: "SCANNING...",
            findStrategies: "FIND STRATEGIES",
            update: "UPDATE",
            checking: "CHECKING...",
            installing: "INSTALLING...",
            debugConsole: "Debug Console",
            waiting: "Waiting for commands..."
        },
        advanced: {
            title: "Advanced Features",
            diagnostics: {
                title: "🔧 Diagnostics",
                desc: "Check system for conflicts"
            },
            installService: {
                title: "📋 Install Service",
                desc: "Auto-start on Windows boot"
            },
            removeService: {
                title: "🗑️ Remove Service",
                desc: "Stop auto-start"
            },
            runTests: {
                title: "🧪 Run Tests",
                desc: "Test strategies"
            },
            gameFilter: {
                title: "🎮 Game Filter",
                on: "Enabled (1024-65535)",
                off: "Disabled (12)"
            },
            ipset: {
                title: "🌐 IPSet",
                loaded: "List Loaded",
                none: "Disabled (All IPs)",
                any: "All IPs (Any)"
            },
            autostart: {
                title: "🚀 Auto-start",
                on: "Start with Windows",
                off: "Do not start automatically"
            },
            networkSettings: {
                title: "🌐 Network/DNS",
                desc: "Open network adapters"
            },
            dnsManager: {
                title: "🛠️ DNS Manager",
                desc: "Quickly change DNS servers",
                selectAdapter: "Select Adapter:",
                currentDns: "Current DNS:",
                dnsV4: "IPv4 DNS",
                dnsV6: "IPv6 DNS",
                doh: "Secure DNS (automatic)",
                setDns: "Set DNS",
                resetDns: "Reset (Auto)",
                apply: "Apply",
                success: "DNS changed successfully!",
                error: "Failed to change DNS"
            }
        },
        testDialog: {
            title: "Test Configuration",
            testType: "TEST TYPE",
            standard: "Standard",
            standardDesc: "HTTP/HTTPS/Ping",
            dpi: "DPI Checkers",
            dpiDesc: "Deep Analysis (Freeze)",
            runMode: "RUN MODE",
            allStrategies: "All Strategies",
            selectManual: "Select Manual",
            selectFiles: "SELECT FILES",
            noStrategies: "No strategies found",
            cancel: "Cancel",
            start: "Start Test"
        },
        logs: {
            checkingUpdates: "Checking for updates...",
            updateAvailable: "✨ Update available: {version}",
            updateLatest: "✓ You have the latest version ({version})",
            updateError: "⚠ Update check error: {message}",
            updateCheckFailed: "⚠ Failed to check updates",
            serviceStarted: "✓ Zapret Service started",
            serviceStartedStrategy: "✓ Zapret Service started (strategy: {strategy})",
            serviceNotRunning: "⚠ Service installed but not running",
            serviceInstalled: "✅ Zapret Service installed! Will start automatically with Windows.",
            serviceInstallFailed: "⚠ Service created but failed to start: {error}",
            serviceRemoved: "✓ Service removed",
            serviceRemoveFailed: "⚠ Service not found or already removed",
            serviceRemoveStarted: "🗑️ Removing Zapret Service...",
            diagnosticsStarted: "🔍 Starting system diagnostics...",
            ipsetLoaded: "📋 IPSet Switch: loaded → none",
            ipsetNone: "📋 IPSet Switch: none → any",
            ipsetAny: "📋 IPSet Switch: any → loaded",
            ipsetRestored: "✓ ipset: loaded (list restored)",
            ipsetDisabled: "✓ ipset: none (IP blocking disabled)",
            ipsetAll: "✓ ipset: any (all IP addresses)",
            ipsetError: "✗ Error: {message}",
            ipsetNoBackup: "✗ No backup to restore. Update list via menu.",
            logSaved: "Logs saved: {path}",
            testingStrategy: "--- Testing: {name} ---",
            strategyFailed: "Failed to start {name}. Skipping...",
            strategySuccess: "SUCCESS! Working strategy: {name}",
            strategyError: "FAILED: {error}",
            scanFinished: "Scan finished. No working strategy found."
        },
        license: {
            title: "License",
            content: `MIT License

Copyright (c) 2026 poluprozra4niy

This software consists of a GUI application and bundled third-party components.
Each component is licensed under its respective license as described below.

============================================================
PRIMARY SOFTWARE COMPONENT
============================================================

1. GUI Application
Copyright (c) 2026 poluprozra4niy
License: MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

============================================================
THIRD-PARTY COMPONENTS
============================================================

2. Electron (GUI Framework)
Copyright (c) OpenJS Foundation and contributors
License: MIT License
Source code: https://github.com/electron/electron

Electron is used as an application framework and runtime environment.
The Electron license permits use, modification, and redistribution under
the terms of the MIT License.

------------------------------------------------------------

3. Zapret-discord-youtube (Modified binaries/scripts)
Copyright (c) 2024–2025 Flowseal
License: MIT License
Repository: https://github.com/Flowseal/zapret-discord-youtube

------------------------------------------------------------

4. Zapret (Original Core)
Copyright (c) 2016–2025 bol-van
License: MIT License
Repository: https://github.com/bol-van/zapret

------------------------------------------------------------

5. WinDivert
Copyright (c) basil00
License: GNU Lesser General Public License (LGPL) Version 3
        or GNU General Public License (GPL) Version 2

Source code: https://github.com/basil00/WinDivert

WinDivert is bundled as an unmodified third-party component.
Its source code is publicly available at the link above, in compliance
with the requirements of the LGPL/GPL licenses.

============================================================
END OF LICENSE
============================================================`
        }
    }
}
