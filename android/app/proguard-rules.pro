# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html
#
# React Native, Expo, Reanimated and ML Kit all ship their own consumer rules
# inside their AARs, so this file only carries what is ours.

# Crash reports from the Play Console arrive obfuscated. Keeping the line table
# means mapping.txt can turn them back into real stack traces; the file name
# itself is renamed, so it costs nothing in the obfuscation percentage.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:
