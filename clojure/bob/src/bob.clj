(ns bob
  (:require [clojure.string :as str]))

(defn question? [s]
  (str/ends-with? s "?"))

(defn yelling? [s]
  (and (re-seq #"[a-zA-Z]" s) (= (str/upper-case s) s)))

(defn response-for [s] ;; <- arglist goes here
  (let [s (str/trim s)]
    (cond
          (and (question? s) (yelling? s)) "Calm down, I know what I'm doing!"
          (question? s) "Sure."
          (yelling? s) "Whoa, chill out!"
          (str/blank? s) "Fine. Be that way!"
          :else "Whatever.")))