import random


def play_number_guessing_game():
    print("=== 数当てゲームへようこそ！ ===")

    # ゲーム全体を繰り返す
    while True:
        # 再挑戦するたびに新しい秘密の数字を生成
        secret_number = random.randint(1, 100)
        attempts = 0

        # 数字を当てるまで繰り返す
        while True:
            try:
                user_input = input(
                    "1から100までの数字を入力してください（終了はq）: "
                )

                if user_input.lower() == "q":
                    print("ゲームを終了します。")
                    return

                guess = int(user_input)

                # 1〜100の範囲外ならやり直す
                if guess < 1 or guess > 100:
                    print("1から100までの数字を入力してください。")
                    continue

                attempts += 1

            except ValueError:
                print("有効な数字を入力してください。")
                continue

            # 入力した数字と秘密の数字を比較
            if guess == secret_number:
                print(f"正解です！ {attempts}回で当てました！")
                break
            elif guess < secret_number:
                print("もっと大きい数字です。")
            else:
                print("もっと小さい数字です。")

        # 正解した後、再挑戦するか確認
        while True:
            retry = input("もう一度遊びますか？（y/n）: ").lower()

            if retry == "y":
                print("\n新しいゲームを開始します！")
                break
            elif retry == "n":
                print("ゲームを終了します。ありがとうございました！")
                return
            else:
                print("yまたはnを入力してください。")


if __name__ == "__main__":
    play_number_guessing_game()