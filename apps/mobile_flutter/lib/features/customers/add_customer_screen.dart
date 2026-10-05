import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/errors/app_exception.dart';
import '../../core/widgets/common.dart';
import 'data/customer_models.dart';
import 'data/customers_repository.dart';

/// Creates a customer. With [returnResult] (used by the POS) it pops with
/// the new [CustomerDetail]; otherwise it opens the customer's page.
class AddCustomerScreen extends ConsumerStatefulWidget {
  const AddCustomerScreen({super.key, this.returnResult = false});
  final bool returnResult;

  @override
  ConsumerState<AddCustomerScreen> createState() => _AddCustomerScreenState();
}

class _AddCustomerScreenState extends ConsumerState<AddCustomerScreen> {
  final _form = GlobalKey<FormState>();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_first, _last, _phone, _email, _address, _city]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final customer = await ref
          .read(customersRepositoryProvider)
          .create(
            NewCustomer(
              firstName: _first.text,
              lastName: _last.text,
              phone: _phone.text,
              email: _email.text,
              addressLine1: _address.text,
              city: _city.text,
            ),
          );
      if (!mounted) return;
      if (widget.returnResult) {
        context.pop(customer);
      } else {
        context.pushReplacement(Routes.customer(customer.id));
      }
    } on AppException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('New customer')),
      body: ContentWidth(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                ),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _first,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'First name *'),
                      validator: (v) => (v ?? '').trim().isEmpty ? 'Required' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _last,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Last name'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Phone *', prefixIcon: Icon(Icons.phone_outlined)),
                validator: (v) {
                  final t = (v ?? '').trim();
                  if (t.length < 6) return 'Enter a valid phone number';
                  if (!RegExp(r'^\+?[\d\s\-()]+$').hasMatch(t)) return 'Digits, spaces, dashes and + only';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
                validator: (v) => (v ?? '').trim().isEmpty || v!.contains('@') ? null : 'Enter a valid email',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _address,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Address', prefixIcon: Icon(Icons.place_outlined)),
                validator: (v) => (v ?? '').trim().isNotEmpty && v!.trim().length < 2 ? 'Too short' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _city,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'City'),
                onFieldSubmitted: (_) => _save(),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: _busy
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                    : const Text('Save customer'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
