<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome');
})->name('home');

Route::get('dashboard', function () {
    return Inertia::render('Dashboard', [
        'username' => \Illuminate\Support\Facades\Auth::user()->name,
        'lazy' => Inertia::defer(function() {
            return 'foo';
        })
    ]);
})->middleware(['auth:sanctum', 'verified'])->name('dashboard');

Route::post('test', function (Request $request) {
    dump($request->all());
})->name('test');

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
