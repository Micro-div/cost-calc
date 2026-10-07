<?php
/**
 * Plugin Name: WooCommerce Country-to-Currency Auto Switcher
 * Description: Auto-detects billing country on WooCommerce order pages, maps it to a currency, alerts the user, and updates the order currency.
 * Version:     1.0.0
 * Author:      Custom Snippet
 * License:     GPL-2.0-or-later
 *
 * Usage: Install via the "Code Snippets" plugin or include in your theme's functions.php.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

/**
 * Enqueue inline JS on the WooCommerce admin order page to watch
 * the billing country field and swap the order currency accordingly.
 */
add_action( 'admin_enqueue_scripts', 'ccs_enqueue_order_currency_switcher' );
function ccs_enqueue_order_currency_switcher( $hook ) {
    // Only load on the WooCommerce "Add/Edit Order" admin screen.
    if ( 'post.php' !== $hook && 'post-new.php' !== $hook ) {
        return;
    }

    $screen = get_current_screen();
    if ( ! $screen || 'shop_order' !== $screen->post_type ) {
        return;
    }

    // Build the country → currency map in PHP and pass it to JS.
    $map = ccs_get_country_currency_map();

    $inline_script = "
        (function ($) {
            'use strict';

            var countryCurrencyMap = " . wp_json_encode( $map ) . ";

            $(document).ready(function () {
                var \$countryField = $('#_billing_country');
                var \$currencyField = $('#_order_currency');

                if (!\$countryField.length) {
                    return;
                }

                \$countryField.on('change', function () {
                    var countryCode = \$(this).val().toUpperCase();
                    var currencyCode = countryCurrencyMap[countryCode];

                    if (!currencyCode) {
                        console.log('[CCS] No currency mapping for country: ' + countryCode);
                        return;
                    }

                    // Update the order currency field.
                    if (\$currencyField.length) {
                        \$currencyField.val(currencyCode).trigger('change');
                    }

                    // Log to browser console.
                    console.log('[CCS] Country changed: ' + countryCode + ' → Currency: ' + currencyCode);

                    // Show an admin alert.
                    alert(
                        'Country changed to ' + countryCode + '\\n' +
                        'Order currency updated to: ' + currencyCode
                    );
                });
            });
        })(jQuery);
    ";

    // Use wp_add_inline_script so we don't need a separate file.
    // Hook it to WooCommerce's admin order script handle (falls back to jquery).
    $handle = 'woocommerce_admin_order';
    if ( ! wp_script_is( $handle, 'registered' ) ) {
        $handle = 'jquery';
    }

    wp_register_script( $handle, '', array(), false, true );
    wp_add_inline_script( $handle, $inline_script );
    wp_enqueue_script( $handle );
}

/**
 * Return the country-code → currency-code mapping.
 *
 * @return array
 */
function ccs_get_country_currency_map() {
    return array(
        'PK' => 'PKR', // Pakistan
        'US' => 'USD', // United States
        'GB' => 'GBP', // United Kingdom
        'AE' => 'AED', // United Arab Emirates
        'SA' => 'SAR', // Saudi Arabia
        'IN' => 'INR', // India
        'AU' => 'AUD', // Australia
        'CA' => 'CAD', // Canada
        'EU' => 'EUR', // Europe
        'JP' => 'JPY', // Japan
        'CN' => 'CNY', // China
        'MY' => 'MYR', // Malaysia
        'SG' => 'SGD', // Singapore
        'TH' => 'THB', // Thailand
        'TR' => 'TRY', // Turkey
    );
}
