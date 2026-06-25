'use strict';
(function (window, $, undefined) {
    if (!$) {
        return;
    }

    var METHOD_META = {
        CreditCard: {
            label: 'Cartão de Crédito',
            getDescription: function (config) {
                var max = parseInt(config.maxInstallments, 10) || 1;
                return max > 1 ? 'Pague em até ' + max + 'x' : 'Pagamento à vista';
            },
            iconClass: 'card'
        },
        DebitCard: {
            label: 'Cartão de Débito',
            getDescription: function () {
                return 'Pagamento instantâneo';
            },
            iconClass: 'debit'
        },
        Pix: {
            label: 'Pix',
            getDescription: function () {
                return 'QR Code liberado na hora';
            },
            iconClass: 'pix'
        }
    };

    function normalizeToNumber(value) {
        var str = value === undefined || value === null ? '' : String(value);
        str = str.replace(/\s+/g, '');
        var hasComma = str.indexOf(',') !== -1;
        str = str.replace(/[^0-9,.-]/g, '');
        if (hasComma) {
            str = str.replace(/\./g, '').replace(',', '.');
        }
        var num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    function formatCurrencyBRL(value) {
        var num = normalizeToNumber(value);
        return 'R$ ' + num.toFixed(2).replace('.', ',');
    }

    function parseNumber(value) {
        return normalizeToNumber(value);
    }

    var GATEWAY_ERROR_TRANSLATIONS = [
        {
            match: 'invalid enrollment request',
            translation: 'Cartão inválido. Verifique os dados e tente novamente.'
        }
    ];

    function translateGatewayMessage(message) {
        var original = message === undefined || message === null ? '' : String(message);
        var trimmed = $.trim(original);
        if (!trimmed) {
            return '';
        }
        var lower = trimmed.toLowerCase();
        for (var i = 0; i < GATEWAY_ERROR_TRANSLATIONS.length; i++) {
            var item = GATEWAY_ERROR_TRANSLATIONS[i];
            if (lower.indexOf(item.match) !== -1) {
                return item.translation;
            }
        }
        return trimmed;
    }

    function createBrandSvg(label, background, textColor) {
        return '' +
            '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + label + '">' +
                '<rect width="48" height="32" rx="6" fill="' + background + '"></rect>' +
                '<text x="24" y="20" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-size="12" fill="' + textColor + '" font-weight="600">' + label + '</text>' +
            '</svg>';
    }

    function createMastercardSvg() {
        return '' +
            '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mastercard">' +
                '<rect width="48" height="32" rx="6" fill="#fff"></rect>' +
                '<circle cx="20" cy="16" r="9" fill="#eb001b"></circle>' +
                '<circle cx="28" cy="16" r="9" fill="#f79e1b" fill-opacity="0.9"></circle>' +
            '</svg>';
    }

    function createHipercardSvg() {
        return '' +
            '<svg viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hipercard">' +
                '<rect width="48" height="32" rx="6" fill="#a6001b"></rect>' +
                '<text x="24" y="20" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-size="10" fill="#fff" font-weight="600">Hiper</text>' +
            '</svg>';
    }

    var CARD_BRAND_ORDER = ['Visa', 'Mastercard', 'Amex', 'Elo', 'Hipercard', 'Diners', 'Discover', 'Jcb', 'Aura', 'Cabal'];

    var CARD_BRANDS = {
        Visa: {
            value: 'Visa',
            label: 'Visa',
            svg: createBrandSvg('VISA', '#1a1f71', '#fff'),
            lengths: [13, 16, 19],
            cvvLengths: [3],
            matcher: function (digits) {
                return /^4/.test(digits);
            }
        },
        Mastercard: {
            value: 'Mastercard',
            label: 'Mastercard',
            svg: createMastercardSvg(),
            lengths: [16],
            cvvLengths: [3],
            matcher: function (digits) {
                if (!digits) {
                    return false;
                }
                var firstTwo = parseInt(digits.substring(0, 2), 10);
                if (!isNaN(firstTwo) && firstTwo >= 51 && firstTwo <= 55) {
                    return true;
                }
                var firstFour = parseInt(digits.substring(0, 4), 10);
                return !isNaN(firstFour) && firstFour >= 2221 && firstFour <= 2720;
            }
        },
        Amex: {
            value: 'Amex',
            label: 'American Express',
            svg: createBrandSvg('AMEX', '#2671b9', '#fff'),
            lengths: [15],
            cvvLengths: [4],
            matcher: function (digits) {
                return /^3[47]/.test(digits);
            }
        },
        Elo: {
            value: 'Elo',
            label: 'Elo',
            svg: createBrandSvg('ELO', '#000', '#fff'),
            lengths: [16],
            cvvLengths: [3],
            matcher: function (digits) {
                if (!digits) {
                    return false;
                }
                var prefixes = ['401178', '401179', '438935', '457631', '457632', '431274', '451416', '457393', '504175', '506699', '5067', '50677', '509', '627780', '636297', '636368', '650031', '650032', '650033', '650035', '6504', '6505', '6507', '6509', '6516', '6550', '655021', '655058'];
                for (var i = 0; i < prefixes.length; i++) {
                    if (digits.indexOf(prefixes[i]) === 0) {
                        return true;
                    }
                }
                return false;
            }
        },
        Hipercard: {
            value: 'Hipercard',
            label: 'Hipercard',
            svg: createHipercardSvg(),
            lengths: [16],
            cvvLengths: [3],
            matcher: function (digits) {
                return /^606282|^3841(?:0|4|6)/.test(digits);
            }
        },
        Diners: {
            value: 'Diners',
            label: 'Diners',
            svg: createBrandSvg('DIN', '#006272', '#fff'),
            lengths: [14, 16],
            cvvLengths: [3],
            matcher: function (digits) {
                return /^3(?:0[0-5]|[68])/.test(digits);
            }
        },
        Discover: {
            value: 'Discover',
            label: 'Discover',
            svg: createBrandSvg('DISC', '#f58220', '#fff'),
            lengths: [16, 19],
            cvvLengths: [3],
            matcher: function (digits) {
                return /^6(?:011|5|4[4-9]|22)/.test(digits);
            }
        },
        Jcb: {
            value: 'Jcb',
            label: 'JCB',
            svg: createBrandSvg('JCB', '#0a5acd', '#fff'),
            lengths: [16, 19],
            cvvLengths: [3],
            matcher: function (digits) {
                return /^(?:2131|1800|35)/.test(digits);
            }
        },
        Aura: {
            value: 'Aura',
            label: 'Aura',
            svg: createBrandSvg('AURA', '#0073cf', '#fff'),
            lengths: [16],
            cvvLengths: [3],
            matcher: function (digits) {
                return /^(?:50[0-9]{2}|5078)/.test(digits);
            }
        },
        Cabal: {
            value: 'Cabal',
            label: 'Cabal',
            svg: createBrandSvg('CAB', '#00355f', '#fff'),
            lengths: [16],
            cvvLengths: [3],
            matcher: function (digits) {
                return /^(?:63[1-3]|6042)/.test(digits);
            }
        }
    };

    function luhnCheck(number) {
        if (!/^[0-9]+$/.test(number)) {
            return false;
        }
        var sum = 0;
        var shouldDouble = false;
        for (var i = number.length - 1; i >= 0; i--) {
            var digit = parseInt(number.charAt(i), 10);
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        return (sum % 10) === 0;
    }

    function CieloCheckout(config) {
        var defaults = {
            checkoutUrl: '',
            statusUrl: '',
            retornoUrl: '',
            defaultInstallments: 1,
            maxInstallments: 1,
            minInstallmentValue: 1,
            container: '#cieloCheckoutInline',
            logoUrl: '',
            continueShoppingUrl: '',
            paymentMethods: ['CreditCard', 'DebitCard', 'Pix'],
            threeDs: {
                enabled: false,
                tokenUrl: '',
                environment: 'PRD',
                debug: false,
                scriptUrl: 'https://mpi.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js'
            }
        };
        this.config = $.extend(true, {}, defaults, config || {});
        if (!this.config.maxInstallments) {
            this.config.maxInstallments = this.config.defaultInstallments || 1;
        }
        if (!this.config.minInstallmentValue || this.config.minInstallmentValue <= 0) {
            this.config.minInstallmentValue = 1;
        }
        this.current = {
            paymentId: null,
            pollTimer: null,
            installments: this.config.defaultInstallments || 1,
            isProcessing: false
        };
        this.$modal = null;
        this._threeDsState = null;
        this._initThreeDs();
    }

    CieloCheckout.prototype._getContainer = function () {
        var selector = this.config.container || '#cieloCheckoutInline';
        var $container = selector ? $(selector).first() : $();

        if (!$container.length) {
            if (selector && selector.charAt(0) === '#') {
                $container = $('<div/>').attr('id', selector.substring(1));
            } else {
                $container = $('<div class="cielo-checkout-container"></div>');
            }
            $('body').append($container);
        }

        return $container;
    };

    CieloCheckout.prototype._getAvailableMethods = function () {
        var list = $.isArray(this.config.paymentMethods) && this.config.paymentMethods.length ? this.config.paymentMethods : ['CreditCard', 'DebitCard', 'Pix'];
        var valid = [];
        $.each(list, function (_, type) {
            if (METHOD_META[type]) {
                valid.push(type);
            }
        });
        return valid;
    };

    CieloCheckout.prototype._getBrandList = function () {
        return CARD_BRAND_ORDER.slice();
    };

    CieloCheckout.prototype._buildBrandOptions = function () {
        var list = this._getBrandList();
        var options = [];
        $.each(list, function (_, brandKey) {
            var def = CARD_BRANDS[brandKey];
            if (def) {
                options.push('<option value="' + def.value + '">' + def.label + '</option>');
            }
        });
        return options.join('');
    };

    CieloCheckout.prototype._getBrandDefinition = function (brandValue) {
        return brandValue && CARD_BRANDS[brandValue] ? CARD_BRANDS[brandValue] : null;
    };

    CieloCheckout.prototype._updateBrandIndicator = function (brandValue) {
        if (!this.$modal) {
            return;
        }
        var $info = this.$modal.find('.cielo-card-brand-info');
        if (!$info.length) {
            return;
        }
        var value = brandValue;
        if (!value) {
            var $select = this.$modal.find('#cieloCardBrand');
            value = $select.length ? $select.val() : '';
        }
        var def = CARD_BRANDS[value];
        var $icon = $info.find('.cielo-card-icon');
        var $label = $info.find('.cielo-card-brand-label');
        if (def) {
            $icon.html(def.svg).show();
            $label.text(def.label);
        } else {
            $icon.empty().hide();
            $label.text('-');
        }
    };

    CieloCheckout.prototype._guessBrandByDigits = function (digits) {
        if (!digits) {
            return '';
        }
        for (var i = 0; i < CARD_BRAND_ORDER.length; i++) {
            var key = CARD_BRAND_ORDER[i];
            var def = CARD_BRANDS[key];
            if (def && typeof def.matcher === 'function' && def.matcher(digits)) {
                return def.value;
            }
        }
        return '';
    };

    CieloCheckout.prototype._handleCardNumberInput = function (value) {
        if (!this.$modal) {
            return;
        }
        var digits = (value || '').replace(/\D+/g, '');
        if (digits.length < 4) {
            this._updateBrandIndicator();
            return;
        }
        var detected = this._guessBrandByDigits(digits);
        if (detected) {
            var $select = this.$modal.find('#cieloCardBrand');
            if ($select.length) {
                $select.val(detected);
            }
            this._updateBrandIndicator(detected);
        } else {
            this._updateBrandIndicator();
        }
    };

    CieloCheckout.prototype._validateCardInputs = function (data) {
        var errors = [];
        var cardNumber = data.cardNumber || '';
        var brand = data.brand;
        var brandDef = this._getBrandDefinition(brand);

        if (!cardNumber || cardNumber.length < 12) {
            errors.push('Informe o número completo do cartão.');
        }

        if (brandDef) {
            if (brandDef.matcher && !brandDef.matcher(cardNumber)) {
                errors.push('O número do cartão não corresponde à bandeira selecionada.');
            }
            if (brandDef.lengths && brandDef.lengths.length && cardNumber.length && brandDef.lengths.indexOf(cardNumber.length) === -1) {
                errors.push('O número informado não possui o comprimento esperado para a bandeira.');
            }
        } else {
            errors.push('Selecione uma bandeira válida.');
        }

        if (cardNumber && !luhnCheck(cardNumber)) {
            errors.push('Número do cartão inválido.');
        }

        var holder = $.trim(data.holder || '');
        if (holder.length < 3) {
            errors.push('Informe o nome completo do titular.');
        }

        var expMonth = parseInt(data.expMonth, 10);
        var expYearRaw = data.expYear || '';
        var expYear = parseInt(expYearRaw, 10);
        if (expYearRaw.length === 2 && expYear >= 0) {
            expYear += 2000;
        }
        if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
            errors.push('Informe um mês de validade válido (01 a 12).');
        }
        if (isNaN(expYear) || expYear < 2000) {
            errors.push('Informe o ano de validade com 4 dígitos.');
        } else {
            var now = new Date();
            var currentYear = now.getFullYear();
            var currentMonth = now.getMonth() + 1;
            if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                errors.push('O cartão informado está vencido.');
            }
        }

        var cvv = data.cvv || '';
        var allowedCvv = brandDef && brandDef.cvvLengths && brandDef.cvvLengths.length ? brandDef.cvvLengths : [3, 4];
        if (!/^[0-9]+$/.test(cvv)) {
            errors.push('Informe apenas números no código de segurança.');
        } else if (allowedCvv.indexOf(cvv.length) === -1) {
            errors.push('Código de segurança com tamanho inválido para esta bandeira.');
        }

        return errors;
    };

    CieloCheckout.prototype._buildMethodsMarkup = function () {
        var self = this;
        var methods = this._getAvailableMethods();
        return $.map(methods, function (type, idx) {
            var meta = METHOD_META[type];
            var classes = 'cielo-method cielo-method--' + type.toLowerCase();
            if (idx === 0) {
                classes += ' is-active';
            }
            return '' +
                '<label class="' + classes + '" data-type="' + type + '">' +
                    '<input type="radio" name="cieloPaymentType" value="' + type + '"' + (idx === 0 ? ' checked' : '') + '>' +
                    '<span class="cielo-method__icon"></span>' +
                    '<div class="cielo-method__texts">' +
                        '<strong>' + meta.label + '</strong>' +
                    '</div>' +
                '</label>';
        }).join('');
    };

    CieloCheckout.prototype._renderModal = function () {
        var $container = this._getContainer();
        this._stopPixPolling();
        $container.empty();

        var methodsHtml = this._buildMethodsMarkup();
        var brandOptions = this._buildBrandOptions();

        var html = '' +
            '<div class="cielo-checkout" id="cieloCheckoutModal" style="display:none;">' +
                '<div class="cielo-checkout__main">' +
                    '<div class="cielo-section">' +
                        '<p class="cielo-section__title">Escolha a forma de pagamento:</p>' +
                        '<div class="cielo-methods">' + methodsHtml + '</div>' +
                        '<p class="cielo-section__note">*Campo obrigatório</p>' +
                    '</div>' +
                    '<div class="cielo-form-head">' +
                        '<h4 id="cieloFormTitle">Cartão de Crédito</h4>' +
                        '<div class="cielo-divider"></div>' +
                    '</div>' +
                    '<form id="cieloCheckoutForm">' +
                        '<div class="cielo-form cielo-form--card">' +
                            '<div class="cielo-field">' +
                                '<label for="cieloCardNumber">Número do cartão</label>' +
                                '<input type="text" id="cieloCardNumber" class="bpmpi_cardnumber" maxlength="19" autocomplete="cc-number" placeholder="0000 0000 0000 0000">' +
                            '</div>' +
                            '<div class="cielo-field cielo-field--brand">' +
                                '<label for="cieloCardBrand">Bandeira <span class="cielo-card-brand-info"><span class="cielo-card-icon" aria-hidden="true"></span><span class="cielo-card-brand-label">-</span></span></label>' +
                                '<select id="cieloCardBrand">' + brandOptions + '</select>' +
                            '</div>' +
                            '<div class="cielo-field">' +
                                '<label for="cieloCardHolder">Nome do dono do cartão</label>' +
                                '<input type="text" id="cieloCardHolder" autocomplete="cc-name" placeholder="Ex: CARLOS A F DE OLIVEIRA">' +
                            '</div>' +
                            '<div class="cielo-field cielo-field--group">' +
                                '<div>' +
                                    '<label for="cieloExpMonth">Data de validade</label>' +
                                    '<div class="cielo-field--grouped">' +
                                        '<input type="text" id="cieloExpMonth" class="bpmpi_cardexpirationmonth" maxlength="2" placeholder="MM">' +
                                        '<input type="text" id="cieloExpYear" class="bpmpi_cardexpirationyear" maxlength="4" placeholder="AAAA">' +
                                    '</div>' +
                                '</div>' +
                                '<div>' +
                                    '<label for="cieloCardCvv">Código de segurança</label>' +
                                    '<input type="password" id="cieloCardCvv" class="bpmpi_securitycode" maxlength="4" autocomplete="cc-csc" placeholder="CVV">' +
                                '</div>' +
                            '</div>' +
                            '<div class="cielo-field cielo-field--installments">' +
                                '<label for="cieloInstallments">Parcelamento <span>Pague em até ' + (parseInt(this.config.maxInstallments, 10) || 1) + 'x</span></label>' +
                                '<select id="cieloInstallments"></select>' +
                            '</div>' +
                        '</div>' +
                        '<div class="cielo-form cielo-form--pix" style="display:none;">' +
                            '<p>Geraremos um QR Code Pix para concluir o pagamento no aplicativo do seu banco. Após pagar, volte e clique em "Verificar pagamento".</p>' +
                            '<ul class="cielo-pix-hints">' +
                                '<li>O QR Code expira após o tempo indicado abaixo.</li>' +
                                '<li>Você pode copiar o código para pagar em outro dispositivo.</li>' +
                            '</ul>' +
                        '</div>' +
                        '<button type="submit" class="cielo-hidden-submit" aria-hidden="true">Enviar</button>' +
                    '</form>' +
                    '<div class="cielo-pix-result" style="display:none;">' +
                        '<div class="cielo-pix-result__content">' +
                            '<p>Escaneie o QR Code ou copie o código Pix abaixo para finalizar.</p>' +
                            '<div class="cielo-pix-result__meta">' +
                                '<div><span>Valor:</span><strong id="cieloPixAmount">R$ 0,00</strong></div>' +
                                '<div><span>Expira em:</span><strong id="cieloPixExpire">-</strong></div>' +
                                '<div><span>Status:</span><strong id="cieloPixStatus">Pendente</strong></div>' +
                            '</div>' +
                            '<div class="cielo-pix-result__qrcode"><img id="cieloPixImage" alt="QR Code Pix" /></div>' +
                            '<textarea readonly id="cieloPixCode"></textarea>' +
                            '<div class="cielo-pix-result__actions">' +
                                '<button type="button" class="cielo-btn-copy">Copiar código Pix</button>' +
                                '<button type="button" class="cielo-btn-verify">Verificar pagamento</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cielo-modal__feedback" id="cieloModalFeedback"></div>' +
                '</div>' +
                '<div class="cielo-checkout__summary">' +
                    '<h4>Resumo do pedido</h4>' +
                    '<ul>' +
                        '<li><span>Valor</span><strong id="cieloResumoValor">R$ 0,00</strong></li>' +
                        '<li><span>Método de pagamento</span><strong id="cieloResumoMetodo">-</strong></li>' +
                        '<li><span>Valor total</span><strong id="cieloResumoTotal">R$ 0,00</strong></li>' +
                    '</ul>' +
                    '<button type="button" id="cieloPrimaryAction">Continuar pagamento</button>' +
                    '<button type="button" id="cieloSecondaryAction">Continuar comprando</button>' +
                '</div>' +
            '</div>' +
            '<style id="cielo-modal-style">' +
                '.cielo-checkout{display:flex;flex-wrap:wrap;gap:24px;background:#f8f8fb;border-radius:28px;padding:24px;margin-top:0;font-family:"Poppins","Segoe UI",Arial,sans-serif;}' +
                '.cielo-checkout__main{flex:1 1 420px;background:#fff;border-radius:24px;padding:30px;border:1px solid #ececf3;box-shadow:0 25px 45px rgba(15,23,42,.08);box-sizing:border-box;}' +
                '.cielo-checkout__summary{flex:0 0 280px;background:#f1f1f6;border-radius:30px;padding:28px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;box-shadow:0 18px 32px rgba(15,23,42,.08);}' +
                '.cielo-section__title{font-weight:700;margin:0 0 12px;color:#2a2a38;text-align:center;}' +
                '.cielo-section__note{font-size:12px;color:#8f8fa0;margin:8px 0 0;}' +
                '.cielo-methods{display:flex;flex-wrap:wrap;gap:12px;}' +
                '.cielo-method{display:flex;align-items:center;gap:14px;border:1px solid #d5d5e5;border-radius:50px;padding:12px 18px;background:#f4f4f9;cursor:pointer;transition:all .15s;text-decoration:none;min-width:180px;flex:1 1 180px;}' +
                '.cielo-method.is-active{border-color:#2b8c46;background:#eef8ed;box-shadow:0 6px 15px rgba(43,140,70,.22);}' +
                '.cielo-method input{position:absolute;opacity:0;pointer-events:none;}' +
                '.cielo-method__icon{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#2b8c46,#7bc043);display:inline-block;position:relative;flex-shrink:0;}' +
                '.cielo-method__icon:after{content:"";position:absolute;top:12px;left:8px;right:8px;bottom:14px;border-radius:6px;background:#fff;}' +
                '.cielo-method--pix .cielo-method__icon{background:linear-gradient(135deg,#22c55e,#4ade80);}' +
                '.cielo-method__texts strong{display:block;font-size:15px;color:#1b1c32;}' +
                '.cielo-method__texts small{display:block;font-size:13px;color:#6c6c80;}' +
                '.cielo-form-head{margin:26px 0 18px;text-align:center;}' +
                '.cielo-form-head h4{margin:0;font-size:20px;color:#1a1b2c;}' +
                '.cielo-form-head p{margin:6px 0 0;font-size:14px;color:#60606f;}' +
                '.cielo-divider{height:1px;background:#ddd;border:0;margin:18px 0 0;}' +
                '.cielo-field{margin-bottom:14px;}' +
                '.cielo-field label{display:flex;justify-content:space-between;font-size:12px;text-transform:uppercase;color:#777;letter-spacing:.08em;margin-bottom:6px;}' +
                '.cielo-field input,.cielo-field select,.cielo-pix-result textarea{width:100%;border:1px solid #d9d9e3;border-radius:14px;padding:12px 14px;font-size:15px;box-sizing:border-box;color:#1a1b2c;background:#fff;}' +
                '.cielo-field input::placeholder{color:#b6b6c4;}' +
                '.cielo-field--group{display:flex;gap:16px;flex-wrap:wrap;}' +
                '.cielo-field--grouped{display:flex;gap:8px;}' +
                '.cielo-card-brand-info{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#1a1b2c;}' +
                '.cielo-card-brand-info .cielo-card-icon{width:40px;height:26px;border:1px solid #d9d9e3;border-radius:8px;padding:2px;background:#fff;display:flex;align-items:center;justify-content:center;}' +
                '.cielo-card-brand-info .cielo-card-icon svg{width:100%;height:100%;display:block;border-radius:6px;}' +
                '.cielo-form--pix{font-size:15px;color:#4b4c60;background:#f8fbff;border:1px dashed #c6d7ff;border-radius:14px;padding:16px;margin-bottom:18px;}' +
                '.cielo-pix-hints{margin:10px 0 0;padding-left:18px;color:#475569;font-size:13px;}' +
                '.cielo-pix-hints li{margin-bottom:4px;}' +
                '.cielo-modal__feedback{display:none;margin:12px 0 0;border-radius:10px;padding:10px 12px;font-size:14px;background:#fee2e2;color:#b45309;}' +
                '.cielo-modal__feedback.ok{background:#ecfdf5;color:#15803d;}' +
                '.cielo-checkout__summary h4{margin:0;font-size:16px;color:#1c1c2e;}' +
                '.cielo-checkout__summary ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;}' +
                '.cielo-checkout__summary li{display:flex;justify-content:space-between;font-size:14px;color:#5b5c68;border-bottom:1px solid #dedee8;padding-bottom:6px;}' +
                '.cielo-checkout__summary li strong{color:#12121f;}' +
                '#cieloPrimaryAction{border:0;border-radius:999px;padding:13px 18px;font-size:15px;font-weight:600;background:#2b8c46;color:#fff;cursor:pointer;transition:.15s;margin-top:auto;}' +
                '#cieloPrimaryAction:disabled{opacity:.6;cursor:not-allowed;}' +
                '#cieloSecondaryAction{border:0;border-radius:999px;padding:13px 18px;font-size:15px;font-weight:600;background:#d4d4da;color:#4a4a57;cursor:pointer;}' +
                '.cielo-pix-result__content{border:1px solid #dbeafe;border-radius:16px;padding:16px;background:#fff;}' +
                '.cielo-pix-result__meta{display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:#475569;margin:10px 0 14px;}' +
                '.cielo-pix-result__meta span{display:block;font-size:12px;color:#94a3b8;letter-spacing:.05em;text-transform:uppercase;}' +
                '.cielo-pix-result__meta strong{font-size:15px;color:#0f172a;}' +
                '.cielo-pix-result__qrcode{display:flex;align-items:center;justify-content:center;margin-bottom:12px;}' +
                '.cielo-pix-result__qrcode img{width:220px;height:220px;border:1px solid #dbeafe;border-radius:12px;background:#fff;object-fit:contain;}' +
                '.cielo-pix-result textarea{height:90px;resize:none;}' +
                '.cielo-pix-result__actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;}' +
                '.cielo-pix-result__actions button{flex:1;border:0;border-radius:10px;padding:10px;font-weight:600;cursor:pointer;}' +
                '.cielo-btn-copy{background:#0f172a;color:#fff;}' +
                '.cielo-btn-verify{background:#22c55e;color:#fff;}' +
                '.cielo-hidden-submit{display:none;}' +
                '@media(max-width:960px){.cielo-checkout{gap:16px;}.cielo-checkout__summary{flex:1 1 100%;order:1;}}' +
                '@media(max-width:640px){.cielo-checkout__main{padding:20px;}.cielo-method{border-radius:20px;}.cielo-field--group{flex-direction:column;}}' +
            '</style>';

        $container.html(html);
        this.$modal = $container.find('#cieloCheckoutModal');
        this._bindEvents();
        this._renderInstallments();
        this._attachThreeDsFields();
        this._updateBrandIndicator(this.$modal.find('#cieloCardBrand').val());
    };

    CieloCheckout.prototype._initThreeDs = function () {
        if (this._threeDsState) {
            return;
        }
        var cfg = this.config.threeDs || {};
        var enabled = cfg.enabled !== false && !!cfg.tokenUrl;
        this._threeDsState = {
            enabled: enabled,
            tokenUrl: cfg.tokenUrl || '',
            environment: cfg.environment || 'PRD',
            debug: !!cfg.debug,
            scriptUrl: cfg.scriptUrl || 'https://mpi.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js',
            accessToken: '',
            tokenPromise: null,
            scriptLoaded: false,
            ready: false,
            readyDeferred: $.Deferred(),
            lastError: null,
            pendingAuth: null
        };
        if (!enabled) {
            this._threeDsState.readyDeferred.resolve();
            return;
        }
        this._fetchThreeDsToken();
    };

    CieloCheckout.prototype._fetchThreeDsToken = function () {
        var state = this._threeDsState;
        if (!state || !state.enabled || !state.tokenUrl) {
            var disabled = $.Deferred();
            disabled.reject('Autenticação 3DS não configurada.');
            return disabled.promise();
        }
        if (state.tokenPromise) {
            return state.tokenPromise;
        }
        var self = this;
        var dfd = $.Deferred();
        $.ajax({
            url: state.tokenUrl,
            type: 'GET',
            dataType: 'json',
            cache: false
        }).done(function (resp) {
            if (resp && resp.status === '00' && resp.accessToken) {
                state.accessToken = resp.accessToken;
                if (resp.environment) {
                    state.environment = resp.environment;
                }
                if (typeof resp.debug !== 'undefined') {
                    state.debug = !!resp.debug;
                }
                dfd.resolve(resp.accessToken);
            } else {
                var msg = resp && resp.msg ? resp.msg : 'Token 3DS indisponível.';
                state.lastError = msg;
                state.readyDeferred.reject(msg);
                dfd.reject(msg);
            }
        }).fail(function () {
            var msg = 'Não foi possível obter o token de autenticação 3DS.';
            state.lastError = msg;
            state.readyDeferred.reject(msg);
            dfd.reject(msg);
        });
        state.tokenPromise = dfd.promise();
        return state.tokenPromise;
    };

    CieloCheckout.prototype._attachThreeDsFields = function () {
        var state = this._threeDsState;
        if (!state || !state.enabled || !this.$modal) {
            return;
        }
        var $form = this.$modal.find('#cieloCheckoutForm');
        if (!$form.length) {
            return;
        }
        if (!$form.find('.cielo-3ds-hidden').length) {
            var hiddenHtml = '' +
                '<div class="cielo-3ds-hidden" style="display:none;">' +
                    '<input type="hidden" class="bpmpi_accesstoken" value="">' +
                    '<input type="hidden" class="bpmpi_auth" value="true">' +
                    '<input type="hidden" class="bpmpi_ordernumber" value="">' +
                    '<input type="hidden" class="bpmpi_currency" value="BRL">' +
                    '<input type="hidden" class="bpmpi_totalamount" value="">' +
                    '<input type="hidden" class="bpmpi_paymentmethod" value="">' +
                    '<input type="hidden" class="bpmpi_installments" value="1">' +
                    '<input type="hidden" class="bpmpi_billto_contactname" value="">' +
                    '<input type="hidden" class="bpmpi_billto_email" value="">' +
                    '<input type="hidden" class="bpmpi_billto_phonenumber" value="">' +
                    '<input type="hidden" class="bpmpi_billto_customerid" value="">' +
                '</div>';
            $form.append(hiddenHtml);
        }
        var self = this;
        this._fetchThreeDsToken().done(function (token) {
            $form.find('.bpmpi_accesstoken').val(token || '');
            self._loadThreeDsScript();
        }).fail(function (message) {
            state.lastError = message;
        });
    };

    CieloCheckout.prototype._loadThreeDsScript = function () {
        var state = this._threeDsState;
        if (!state || !state.enabled || state.scriptLoaded || !state.accessToken) {
            return;
        }
        state.scriptLoaded = true;
        var self = this;
        window.bpmpi_config = function () {
            return self._buildThreeDsConfig();
        };
        var script = document.createElement('script');
        script.src = state.scriptUrl;
        script.async = true;
        script.onerror = function () {
            state.lastError = 'Não foi possível carregar os recursos de autenticação 3DS.';
            state.readyDeferred.reject(state.lastError);
        };
        document.head.appendChild(script);
    };

    CieloCheckout.prototype._buildThreeDsConfig = function () {
        var self = this;
        var state = this._threeDsState || {};
        return {
            Debug: !!state.debug,
            Environment: state.environment || 'PRD',
            onReady: function () { self._onThreeDsReady(); },
            onSuccess: function (data) { self._onThreeDsSuccess(data); },
            onFailure: function (data) { self._onThreeDsFailure('Falha na autenticação 3DS.', data); },
            onError: function (data) {
                var rawMessage = data && data.ReturnMessage ? data.ReturnMessage : 'Erro na autenticação 3DS.';
                var message = translateGatewayMessage(rawMessage) || 'Erro na autenticação 3DS.';
                self._onThreeDsFailure(message, data);
            },
            onUnenrolled: function (data) { self._onThreeDsFailure('Cartão não elegível para 3DS.', data); },
            onUnsupportedBrand: function (data) { self._onThreeDsFailure('Bandeira não suportada para 3DS.', data); },
            onChallengeSuppression: function (data) { self._onThreeDsFailure('Autenticação 3DS interrompida.', data); },
            onDisabled: function () { self._onThreeDsFailure('Autenticação 3DS indisponível.', null); }
        };
    };

    CieloCheckout.prototype._onThreeDsReady = function () {
        var state = this._threeDsState;
        if (!state) {
            return;
        }
        state.ready = true;
        if (state.readyDeferred) {
            state.readyDeferred.resolve();
        }
    };

    CieloCheckout.prototype._onThreeDsSuccess = function (data) {
        var state = this._threeDsState;
        if (!state || !state.pendingAuth) {
            return;
        }
        var payload = {
            Eci: data && data.Eci ? data.Eci : '',
            Cavv: data && data.Cavv ? data.Cavv : '',
            Xid: data && data.Xid ? data.Xid : '',
            Version: data && data.Version ? data.Version : '',
            ReferenceId: data && data.ReferenceId ? data.ReferenceId : ''
        };
        state.pendingAuth.resolve(payload);
        state.pendingAuth = null;
    };

    CieloCheckout.prototype._onThreeDsFailure = function (message, data) {
        var state = this._threeDsState;
        if (!state) {
            return;
        }
        var fallback = (data && data.ReturnMessage) || message || 'Falha na autenticação 3DS.';
        var errorMsg = translateGatewayMessage(fallback) || 'Falha na autenticação 3DS.';
        state.lastError = errorMsg;
        if (state.pendingAuth) {
            state.pendingAuth.reject(errorMsg);
            state.pendingAuth = null;
        }
    };

    CieloCheckout.prototype._ensureMounted = function () {
        if (this.$modal && this.$modal.length) {
            return;
        }
        this._renderModal();
    };

    CieloCheckout.prototype._bindEvents = function () {
        if (!this.$modal || !this.$modal.length) {
            return;
        }
        var self = this;
        this.$modal.off('.cieloCheckout');
        this.$modal.on('change.cieloCheckout', 'input[name="cieloPaymentType"]', function () {
            self.$modal.find('.cielo-method').removeClass('is-active');
            $(this).closest('.cielo-method').addClass('is-active');
            self._toggleFields($(this).val());
            self._updateSummary();
        });
        this.$modal.on('submit.cieloCheckout', '#cieloCheckoutForm', function (e) {
            e.preventDefault();
            self._submit();
        });
        this.$modal.on('click.cieloCheckout', '#cieloPrimaryAction', function (e) {
            e.preventDefault();
            if ($(this).prop('disabled')) {
                return;
            }
            self.$modal.find('#cieloCheckoutForm').trigger('submit');
        });
        this.$modal.on('click.cieloCheckout', '#cieloSecondaryAction', function (e) {
            e.preventDefault();
            if (typeof self.config.onContinueShopping === 'function') {
                self.config.onContinueShopping();
            } else if (self.config.continueShoppingUrl) {
                window.location = self.config.continueShoppingUrl;
            } else {
                self.close();
            }
        });
        this.$modal.on('click.cieloCheckout', '.cielo-btn-copy', function () {
            var $code = self.$modal.find('#cieloPixCode');
            $code.trigger('select');
            document.execCommand('copy');
            self._setFeedback('Código Pix copiado para a área de transferência.', 'ok');
        });
        this.$modal.on('click.cieloCheckout', '.cielo-btn-verify', function () {
            self._checkPixStatus();
        });
        this.$modal.on('change.cieloCheckout', '#cieloInstallments', function () {
            var selected = parseInt($(this).val(), 10);
            if (isNaN(selected) || !selected) {
                selected = self.config.defaultInstallments || 1;
            }
            self.current.installments = selected;
        });
        this.$modal.on('input.cieloCheckout', '#cieloCardNumber', function () {
            self._handleCardNumberInput($(this).val());
        });
        this.$modal.on('change.cieloCheckout', '#cieloCardBrand', function () {
            self._updateBrandIndicator($(this).val());
        });
    };

    CieloCheckout.prototype.updateConfig = function (config) {
        var prevContainer = this.config.container;
        this.config = $.extend(true, {}, this.config, config || {});
        if (!this.config.maxInstallments) {
            this.config.maxInstallments = this.config.defaultInstallments || 1;
        }
        if (!this.config.minInstallmentValue || this.config.minInstallmentValue <= 0) {
            this.config.minInstallmentValue = 1;
        }
        if (config && config.container && config.container !== prevContainer) {
            this.$modal = null;
        }
        if (config && config.threeDs && !this._threeDsState.enabled) {
            this._threeDsState = null;
            this._initThreeDs();
        }
    };

    CieloCheckout.prototype._getSelectedPaymentType = function () {
        if (!this.$modal) {
            return 'CreditCard';
        }
        var $radio = this.$modal.find('input[name="cieloPaymentType"]:checked');
        return $radio.length ? $radio.val() : 'CreditCard';
    };

    CieloCheckout.prototype._updateSummary = function () {
        if (!this.$modal) {
            return;
        }
        var type = this._getSelectedPaymentType();
        var meta = METHOD_META[type];
        this.$modal.find('#cieloResumoValor, #cieloResumoTotal').text(formatCurrencyBRL(this.current.valor));
        this.$modal.find('#cieloResumoMetodo').text(meta ? meta.label : type);
        this.$modal.find('#cieloFormTitle').text(meta ? meta.label : type);
    };

    CieloCheckout.prototype._renderInstallments = function () {
        if (!this.$modal) {
            return;
        }
        var $select = this.$modal.find('#cieloInstallments');
        if (!$select.length) {
            return;
        }
        var max = this._getMaxInstallmentsForAmount();
        var valor = parseNumber(this.current.valor);
        $select.empty();
        for (var i = 1; i <= max; i++) {
            var parcela = valor / i;
            var label = i + 'x ' + formatCurrencyBRL(parcela);
            $select.append('<option value="' + i + '">' + label + '</option>');
        }
        var defaultInstallments = this.current.installments || this.config.defaultInstallments || 1;
        if (defaultInstallments > max) {
            defaultInstallments = max;
        }
        this.current.installments = defaultInstallments;
        $select.val(String(defaultInstallments));
        this.$modal.find('.cielo-field--installments span').text('Pague em até ' + max + 'x');
        this.$modal.find('.cielo-field--installments').toggle(max > 1);
    };

    CieloCheckout.prototype._getMaxInstallmentsForAmount = function () {
        var configMax = parseInt(this.config.maxInstallments, 10) || 1;
        var valor = parseNumber(this.current.valor);
        var minValue = parseFloat(this.config.minInstallmentValue);
        if (!minValue || minValue <= 0) {
            minValue = 1;
        }
        var maxByValue = Math.floor(valor / minValue);
        if (maxByValue < 1) {
            maxByValue = 1;
        }
        if (maxByValue > configMax) {
            maxByValue = configMax;
        }
        return maxByValue;
    };

    CieloCheckout.prototype._toggleFields = function (type) {
        if (!this.$modal) {
            return;
        }
        this.$modal.find('.cielo-form').hide();
        var $primaryButton = this.$modal.find('#cieloPrimaryAction');
        if (type === 'Pix') {
            this.$modal.find('.cielo-form--pix').show();
            $primaryButton.hide();
        } else {
            this.$modal.find('.cielo-form--card').show();
            $primaryButton.show().prop('disabled', false);
        }
        var $installmentsField = this.$modal.find('.cielo-field--installments');
        if ($installmentsField.length) {
            var isCredit = (type === 'CreditCard');
            if (!isCredit) {
                $installmentsField.hide();
                this.current.installments = 1;
                var $installmentsSelect = this.$modal.find('#cieloInstallments');
                if ($installmentsSelect.length) {
                    $installmentsSelect.val('1');
                }
            } else {
                var max = this._getMaxInstallmentsForAmount();
                $installmentsField.toggle(max > 1);
            }
        }
        this.$modal.find('.cielo-pix-result').hide();
        this.$modal.find('#cieloCheckoutForm').show();
        this._setPrimaryButtonLabel(type);
        if (type === 'Pix') {
            this._handlePixAutoSubmit();
        }
    };

    CieloCheckout.prototype._handlePixAutoSubmit = function () {
        if (!this.$modal || this.current.isProcessing) {
            return;
        }
        if (this.$modal.find('.cielo-pix-result:visible').length > 0) {
            return;
        }
        this._submit();
    };

    CieloCheckout.prototype._setPrimaryButtonLabel = function (type) {
        var $btn = this.$modal ? this.$modal.find('#cieloPrimaryAction') : $();
        if (!$btn.length) {
            return;
        }
        var text = (type === 'Pix') ? 'Gerar QR Code Pix' : 'Continuar pagamento';
        $btn.text(text);
    };

    CieloCheckout.prototype._setFeedback = function (message, type) {
        if (!this.$modal) {
            return;
        }
        var $feedback = this.$modal.find('#cieloModalFeedback');
        $feedback.removeClass('ok');
        if (!message) {
            $feedback.hide().text('');
            return;
        }
        if (type === 'ok') {
            $feedback.addClass('ok');
        }
        $feedback.text(message).show();
    };

    CieloCheckout.prototype._shouldUseThreeDs = function (type) {
        return type === 'DebitCard' && this._threeDsState && this._threeDsState.enabled;
    };

    CieloCheckout.prototype._executeThreeDs = function (cardPayload) {
        var state = this._threeDsState;
        var self = this;
        var ready = state && state.readyDeferred ? state.readyDeferred : $.Deferred().resolve();
        var finalDeferred = $.Deferred();

        if (!state || !state.enabled) {
            finalDeferred.reject('Autenticação 3DS indisponível.');
            return finalDeferred.promise();
        }

        ready.done(function () {
            if (state.lastError) {
                finalDeferred.reject(state.lastError);
                return;
            }
            if (typeof window.bpmpi_authenticate !== 'function') {
                finalDeferred.reject('Biblioteca de autenticação 3DS não carregada.');
                return;
            }
            self._fillThreeDsHiddenFields(cardPayload);
            state.pendingAuth = $.Deferred();
            state.pendingAuth.done(function (payload) {
                finalDeferred.resolve(payload);
            }).fail(function (err) {
                finalDeferred.reject(err || 'Falha na autenticação 3DS.');
            });
            try {
                bpmpi_authenticate();
            } catch (err) {
                if (state.pendingAuth) {
                    state.pendingAuth.reject('Não foi possível iniciar a autenticação 3DS.');
                    state.pendingAuth = null;
                }
            }
        }).fail(function (err) {
            finalDeferred.reject(err || state.lastError || 'Autenticação 3DS indisponível.');
        });

        return finalDeferred.promise();
    };

    CieloCheckout.prototype._fillThreeDsHiddenFields = function (cardPayload) {
        if (!this.$modal) {
            return;
        }
        var $form = this.$modal.find('#cieloCheckoutForm');
        if (!$form.length) {
            return;
        }
        $form.find('.bpmpi_ordernumber').val(this.current.idcompra || '');
        $form.find('.bpmpi_totalamount').val(this._formatThreeDsAmount(this.current.valor));
        $form.find('.bpmpi_currency').val('BRL');
        $form.find('.bpmpi_paymentmethod').val('DebitCard');
        $form.find('.bpmpi_installments').val('1');
        $form.find('.bpmpi_billto_contactname').val(cardPayload && cardPayload.holder ? cardPayload.holder : (this.current.nome || ''));
        $form.find('.bpmpi_billto_email').val(this.current.email || '');
        $form.find('.bpmpi_billto_phonenumber').val(this.current.telefone || '');
        $form.find('.bpmpi_billto_customerid').val(this.current.document || '');
    };

    CieloCheckout.prototype._syncThreeDsOrderData = function () {
    if (!this.$modal || !this._threeDsState || !this._threeDsState.enabled) {
        return;
    }
    var $form = this.$modal.find('#cieloCheckoutForm');
    if (!$form.length) {
        return;
    }

    $form.find('.bpmpi_ordernumber').val(this.current.idcompra || '');
    $form.find('.bpmpi_totalamount').val(this._formatThreeDsAmount(this.current.valor));
    $form.find('.bpmpi_currency').val('BRL');
    };


    CieloCheckout.prototype._formatThreeDsAmount = function (value) {
        var amount = Math.round(parseNumber(value) * 100);
        return amount > 0 ? String(amount) : '';
    };

    CieloCheckout.prototype._resetProcessingState = function (type) {
        this.current.isProcessing = false;
        if (!this.$modal) {
            return;
        }
        var $primaryButton = this.$modal.find('#cieloPrimaryAction');
        $primaryButton.prop('disabled', false);
        this._setPrimaryButtonLabel(type || this._getSelectedPaymentType());
    };

    CieloCheckout.prototype.open = function (options) {
        this._ensureMounted();
        this._stopPixPolling();
        if (!this.$modal || !this.$modal.length) {
            alert('Não foi possível carregar o formulário de pagamento.');
            return;
        }
        this.current = $.extend({}, this.current, {
            idcompra: options.idcompra,
            valor: options.valor,
            nome: options.nome || '',
            email: options.email || '',
            telefone: options.telefone || '',
            document: options.document || '',
            paymentId: null,
            isProcessing: false
        });
        this.$modal.find('#cieloCheckoutForm')[0].reset();
        this.$modal.find('.cielo-method').removeClass('is-active').first().addClass('is-active');
        this.$modal.find('input[name="cieloPaymentType"]').prop('checked', false).first().prop('checked', true);
        this.current.installments = this.config.defaultInstallments || 1;
        this._syncThreeDsOrderData();
        this._renderInstallments();
        this._toggleFields(this._getSelectedPaymentType());
        this._updateSummary();
        this._setFeedback('');
        this.$modal.find('.cielo-pix-result').hide();
        this.$modal.find('#cieloPrimaryAction').prop('disabled', false);
        this.$modal.stop(true, true).slideDown(200);
        if (this.$modal.offset()) {
            $('html, body').animate({ scrollTop: Math.max(this.$modal.offset().top - 30, 0) }, 280);
        }
    };

    CieloCheckout.prototype.close = function () {
        if (!this.$modal) {
            return;
        }
        this._stopPixPolling();
        this.$modal.stop(true, true).slideUp(150);
        this.$modal.find('.cielo-pix-result').hide();
        this.$modal.find('#cieloCheckoutForm').show();
        this._setFeedback('');
    };

    CieloCheckout.prototype._submit = function () {
        if (this.current.isProcessing) {
            return;
        }
        var type = this._getSelectedPaymentType();
        var payload = {
            idcompra: this.current.idcompra,
            valor: this.current.valor,
            nome: this.current.nome,
            email: this.current.email,
            telefone: this.current.telefone,
            document: this.current.document,
            payment: {
                type: type,
                installments: (type === 'CreditCard') ? (this.current.installments || this.config.defaultInstallments || 1) : 1
            }
        };
        var cardPayload = null;

        if (type === 'CreditCard' || type === 'DebitCard') {
            var cardNumber = this.$modal.find('#cieloCardNumber').val().replace(/\D+/g, '');
            var holder = $.trim(this.$modal.find('#cieloCardHolder').val());
            var expMonth = this.$modal.find('#cieloExpMonth').val().replace(/\D+/g, '');
            var expYear = this.$modal.find('#cieloExpYear').val().replace(/\D+/g, '');
            var cvv = this.$modal.find('#cieloCardCvv').val().replace(/\D+/g, '');
            var brand = this.$modal.find('#cieloCardBrand').val() || 'Visa';

            var validationErrors = this._validateCardInputs({
                cardNumber: cardNumber,
                holder: holder,
                expMonth: expMonth,
                expYear: expYear,
                cvv: cvv,
                brand: brand
            });

            if (validationErrors.length) {
                this._setFeedback(validationErrors.join(' '));
                return;
            }

            cardPayload = {
                cardNumber: cardNumber,
                holder: holder,
                expirationMonth: expMonth,
                expirationYear: expYear,
                securityCode: cvv,
                brand: brand
            };

            if (type === 'DebitCard') {
                payload.payment.debitCard = cardPayload;
            } else {
                payload.payment.creditCard = cardPayload;
            }
        }

        var self = this;
        var $primaryButton = this.$modal.find('#cieloPrimaryAction');
        this.current.isProcessing = true;
        $primaryButton.prop('disabled', true).text('Processando...');

        var sendRequest = function () {
            if (type === 'Pix') {
                self.current.paymentId = null;
                self._setFeedback('Gerando QR Code Pix...');
            } else {
                self._setFeedback('');
            }
            $.ajax({
                url: self.config.checkoutUrl,
                type: 'POST',
                dataType: 'json',
                contentType: 'application/json; charset=UTF-8',
                data: JSON.stringify(payload)
            }).done(self._handleSuccess.bind(self, type))
              .fail(self._handleFail.bind(self));
        };

        if (this._shouldUseThreeDs(type)) {
            if (!cardPayload) {
                this._setFeedback('Não foi possível validar os dados do cartão.');
                this._resetProcessingState(type);
                return;
            }
            this._setFeedback('Validando segurança do cartão...');
            this._executeThreeDs(cardPayload).done(function (authData) {
                payload.payment.externalAuthentication = authData;
                sendRequest();
            }).fail(function (msg) {
                self._setFeedback(msg || 'Não foi possível autenticar o cartão de débito.');
                self._resetProcessingState(type);
            });
            return;
        }

        sendRequest();
    };

    CieloCheckout.prototype._handleSuccess = function (type, resp) {
        this.current.isProcessing = false;
        this.$modal.find('#cieloPrimaryAction').prop('disabled', false);
        this._setPrimaryButtonLabel(type);

        if (!resp || resp.status !== '00') {
            this._setFeedback(resp && resp.msg ? resp.msg : 'Não foi possível processar o pagamento.');
            return;
        }

        if (type === 'Pix') {
            if (this._getSelectedPaymentType() !== 'Pix') {
                return;
            }
            this._renderPixResult(resp);
            return;
        }

        if (resp.paymentId && this.config.retornoUrl) {
            window.location = this.config.retornoUrl + '?payment_id=' + encodeURIComponent(resp.paymentId);
        } else {
            this._setFeedback('Pagamento criado com sucesso, mas não foi possível redirecionar automaticamente.', 'ok');
        }
    };

    CieloCheckout.prototype._handleFail = function () {
        this.current.isProcessing = false;
        this.$modal.find('#cieloPrimaryAction').prop('disabled', false);
        this._setFeedback('Falha ao comunicar com a Cielo. Tente novamente.');
    };

    CieloCheckout.prototype._renderPixResult = function (resp) {
        var payment = (resp && resp.sale && resp.sale.Payment) ? resp.sale.Payment : {};
        var qrImage = payment.QrCodeBase64Image || payment.qrCodeBase64Image ||
            payment.QrCodeBase64 || payment.qrCodeBase64 || '';
        var qrString = payment.QrCodeString || payment.qrCodeString || '';
        if (!qrString && typeof payment.QrCode === 'string') {
            qrString = payment.QrCode;
        } else if (!qrString && typeof payment.qrCode === 'string') {
            qrString = payment.qrCode;
        }

        this.current.paymentId = resp.paymentId || payment.PaymentId || payment.paymentId || null;
        var $result = this.$modal.find('.cielo-pix-result');
        this.$modal.find('#cieloPixAmount').text(formatCurrencyBRL(this.current.valor));
        this.$modal.find('#cieloPixStatus').text('Pendente');
        var expirationSeconds = null;
        if (payment.QrCode && typeof payment.QrCode === 'object') {
            expirationSeconds = parseInt(payment.QrCode.Expiration || payment.QrCode.expiration, 10);
        }
        if (!expirationSeconds && payment.QrCode && typeof payment.QrCode === 'number') {
            expirationSeconds = parseInt(payment.QrCode, 10);
        }
        var expireText = '-';
        if (expirationSeconds && expirationSeconds > 0) {
            var hours = Math.floor(expirationSeconds / 3600);
            var minutes = Math.ceil((expirationSeconds % 3600) / 60);
            expireText = (hours > 0 ? hours + 'h ' : '') + minutes + 'min';
            if (payment.ReceivedDate) {
                var start = new Date(payment.ReceivedDate.replace(' ', 'T'));
                if (!isNaN(start.getTime())) {
                    var end = new Date(start.getTime() + expirationSeconds * 1000);
                    expireText += ' (até ' + end.toLocaleString('pt-BR') + ')';
                }
            }
        }
        this.$modal.find('#cieloPixExpire').text(expireText);
        var $img = this.$modal.find('#cieloPixImage');
        if ($img.length) {
            if (qrImage) {
                $img.attr('src', 'data:image/png;base64,' + qrImage).show();
            } else {
                $img.removeAttr('src').hide();
                this._setFeedback('QR Code indisponível no momento. Tente novamente.', 'error');
            }
        }

        this.$modal.find('#cieloPixCode').val(qrString);
        this.$modal.find('#cieloCheckoutForm').hide();
        $result.show();
        this._setFeedback('Pix gerado. Conclua o pagamento e clique em "Verificar pagamento" para confirmar.', 'ok');
        this._startPixPolling();
    };

    CieloCheckout.prototype._startPixPolling = function () {
        var self = this;
        this._stopPixPolling();
        if (!this.config.statusUrl || !this.current.paymentId) {
            return;
        }
        this.current.pollTimeout = setTimeout(function () {
            self._checkPixStatus(true);
        }, 2500);
        this.current.pollTimer = setInterval(function () {
            self._checkPixStatus(true);
        }, 8000);
    };

    CieloCheckout.prototype._stopPixPolling = function () {
        if (this.current.pollTimeout) {
            clearTimeout(this.current.pollTimeout);
            this.current.pollTimeout = null;
        }
        if (this.current.pollTimer) {
            clearInterval(this.current.pollTimer);
            this.current.pollTimer = null;
        }
    };

    CieloCheckout.prototype._checkPixStatus = function (silent) {
        var self = this;
        if (!this.config.statusUrl || !this.current.paymentId) {
            this._setFeedback('Não foi possível verificar o status do pagamento Pix.');
            return;
        }

        if (!silent) {
            this._setFeedback('Consultando status do Pix...');
        }

        $.ajax({
            url: this.config.statusUrl,
            type: 'GET',
            dataType: 'json',
            data: {
                payment_id: this.current.paymentId,
                reference: this.current.idcompra
            }
        }).done(function (resp) {
            var statusLabel = 'Pendente';
            if (resp && resp.status === '00' && resp.dados) {
                var st = parseInt(resp.dados.status, 10);
                if (st === 3 || st === 4) {
                    self.$modal.find('#cieloPixStatus').text('Pago');
                    self._setFeedback('Pagamento confirmado! Você pode fechar o checkout e continuar navegando.', 'ok');
                    self._stopPixPolling();
                    return;
                }
                if (st === 1 || st === 2 || st === 12) {
                    statusLabel = 'Em processamento';
                }
            } else {
                statusLabel = 'Indisponível';
            }

            self.$modal.find('#cieloPixStatus').text(statusLabel);

            if (!silent) {
                if (statusLabel === 'Pendente') {
                    self._setFeedback('Pagamento ainda pendente. Assim que finalizar, clique novamente em verificar.');
                } else if (statusLabel === 'Em processamento') {
                    self._setFeedback('Estamos aguardando a confirmação do banco. Tente novamente em instantes.');
                } else if (statusLabel === 'Indisponível') {
                    self._setFeedback('Não foi possível consultar o status do Pix agora.');
                }
            }
        }).fail(function () {
            self.$modal.find('#cieloPixStatus').text('Indisponível');
            if (!silent) {
                self._setFeedback('Não foi possível consultar o status do Pix agora.');
            }
        });
    };
    window.CieloCheckout = function (config) {
        if (window.__CieloCheckoutInstance) {
            window.__CieloCheckoutInstance.updateConfig(config || {});
            return window.__CieloCheckoutInstance;
        }
        window.__CieloCheckoutInstance = new CieloCheckout(config || {});
        return window.__CieloCheckoutInstance;
    };
})(window, window.jQuery);
