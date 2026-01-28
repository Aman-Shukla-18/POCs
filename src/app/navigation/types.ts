import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Todos Stack
export type TodosStackParamList = {
  TodosList: undefined;
  TodoDetail: { todoId: string };
  TodoForm: { todoId?: string }; // undefined = create, defined = edit
};

// Categories Stack
export type CategoriesStackParamList = {
  CategoriesList: undefined;
  CategoryForm: { categoryId?: string }; // undefined = create, defined = edit
};

// Bottom Tabs
export type MainTabParamList = {
  TodosTab: NavigatorScreenParams<TodosStackParamList>;
  CategoriesTab: NavigatorScreenParams<CategoriesStackParamList>;
};

// Root Stack (could add modals, auth screens later)
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Screen props types
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type TodosStackScreenProps<T extends keyof TodosStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<TodosStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type CategoriesStackScreenProps<T extends keyof CategoriesStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CategoriesStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// Global navigation type declaration for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
